import { create } from 'zustand'
import { sb, PALETTE } from '../data/supabaseClient.js'
import { resolveHousehold, loadState, migratePersonalAllowance, SupabaseUnreachableError } from '../data/loadState.js'
import {
  budgetChangeToRow,
  rateChangeToRow,
  txToRow,
  bonusCreditToRow,
  livingCatToRow,
  irregularToRow,
  fixedToRow,
  payToRow,
  incomeCatToRow,
  notifSettingsToRow,
} from '../data/converters.js'
import { todayKST, monthKey } from '../lib/calc.js'
import { findCatPool } from '../lib/selectors.js'
import { VAPID_PUBLIC_KEY } from '../data/supabaseClient.js'
import { urlBase64ToUint8Array, registerServiceWorker } from '../lib/push.js'

// "이 달부터" 변경 이력(생활 예산/누적 충전액)에 공통되는 upsert 로직. id는 매칭 필드+effectiveMonth로
// 결정되므로, 있으면 그 id로 덮어쓰고 없으면 새로 만든다 — 두 스토어 액션(upsertLivingBudgetRate/
// upsertEnvelopeRate)이 테이블명·필드명·토스트 문구만 다르고 나머지는 완전히 같아서 여기로 뽑아냈다.
async function upsertRateChange(get, set, { list, listKey, table, toRow, idPrefix, keyField, keyValue, effectiveMonth, amount, failMsg, successMsg }) {
  const existing = list.find((r) => r[keyField] === keyValue && r.effectiveMonth === effectiveMonth)
  const row = { id: existing ? existing.id : `${idPrefix}_${keyValue}_${effectiveMonth}`, [keyField]: keyValue, effectiveMonth, amount }
  const { error } = await sb.from(table).upsert(toRow(row, get().household))
  if (error) {
    get().showToast(failMsg)
    console.error(error)
    return
  }
  set({ [listKey]: existing ? list.map((r) => (r === existing ? row : r)) : [...list, row] })
  get().showToast(successMsg)
}

// viewDate(지금 보고 있는 달)는 캘린더/예산/분석 탭이 전부 공유하는 값이라 스토어에 둔다.
// (오늘 이 화면 저 화면 다니면서 같은 달 데이터를 봐야 하므로, 화면별 로컬 state로 두면 안 맞물린다.)
function initialViewDate() {
  const [y, m, d] = todayKST().split('-').map(Number)
  return new Date(y, m - 1, d)
}

// authStatus 상태 전이: loading → (signed-out | needs-household | ready)
// 원본의 startApp()/finishStartup() 패턴을 그대로 옮기되, DOM 화면 show/hide 대신 이 상태값으로 어떤
// 화면을 보여줄지 App.jsx가 결정한다.

const initialData = {
  livingCategories: [],
  irregularEnvelopes: [],
  transactions: [],
  fixedExpenses: [],
  payMethods: [],
  livingBudgetChanges: [],
  envelopeRateChanges: [],
  envelopeBonusCredits: [],
  incomeCategories: [],
  household: null,
  myUserId: null,
  householdMembers: [],
  notificationSettings: { dailyReminderEnabled: true, dailyReminderHour: 21 },
  pushSubscribed: false,
}

export const useAppStore = create((set, get) => ({
  authStatus: 'loading', // 'loading' | 'signed-out' | 'needs-household' | 'ready'
  toast: null,
  nextColorIdx: 0,
  viewDate: initialViewDate(),
  activeCol: 'calendar', // 'calendar' | 'budget' | 'analysis'
  selectedCalDate: null,
  txSheetOpen: false,
  editingTxId: null,
  editingInstMonth: null,
  settingsSheetOpen: false,
  ...initialData,

  shiftMonth(delta) {
    set((s) => ({ viewDate: new Date(s.viewDate.getFullYear(), s.viewDate.getMonth() + delta, 1) }))
  },
  setActiveCol(col) {
    set({ activeCol: col })
  },
  setSelectedCalDate(dateStr) {
    set({ selectedCalDate: dateStr })
  },

  openTxSheet(txId, instMonth) {
    set({ txSheetOpen: true, editingTxId: txId || null, editingInstMonth: instMonth || null })
  },
  closeTxSheet() {
    set({ txSheetOpen: false, editingTxId: null, editingInstMonth: null })
  },

  categoryScope() {
    const s = get()
    return { household: s.household, irregularEnvelopes: s.irregularEnvelopes, livingCategories: s.livingCategories, incomeCategories: s.incomeCategories }
  },

  // editingId가 있으면 수정, 없으면 새 거래 추가. payload.type이 최종 거래 타입.
  async submitTransaction(editingId, payload) {
    const id = editingId || Date.now().toString(36)
    const { error } = await sb.from('transactions').upsert(txToRow({ id, ...payload }, get().categoryScope()))
    if (error) {
      get().showToast('저장 실패, 다시 시도해주세요')
      console.error(error)
      return { ok: false }
    }
    const toastMsg =
      {
        transfer: editingId ? '이체를 수정했어요' : '이체를 완료했어요',
        income: editingId ? '수입을 수정했어요' : '수입을 추가했어요',
        settlement: editingId ? '정산을 수정했어요' : '정산을 추가했어요',
      }[payload.type] || (editingId ? '지출을 수정했어요' : '지출을 추가했어요')

    set((s) => ({
      transactions: editingId
        ? s.transactions.map((t) => (t.id === editingId ? { ...t, ...payload } : t))
        : [...s.transactions, { id, ...payload }],
      // 새/수정된 거래의 날짜가 속한 달로 화면을 옮겨준다 (원본 동작 그대로)
      viewDate: new Date(payload.date),
    }))
    get().showToast(toastMsg)
    return { ok: true, id }
  },

  // 할부 특정 회차만 금액을 수동 조정. 다른 회차는 자동 재분배하지 않는다 (의도된 동작, 버그 아님).
  async updateInstallmentOverride(txId, instMonth, amount) {
    const origin = get().transactions.find((t) => t.id === txId)
    if (!origin) return { ok: false }
    const overrides = { ...(origin.installmentOverrides || {}), [instMonth]: amount }
    const { error } = await sb.from('transactions').update({ installment_overrides: overrides }).eq('id', txId)
    if (error) {
      get().showToast('저장 실패, 다시 시도해주세요')
      console.error(error)
      return { ok: false }
    }
    set((s) => ({ transactions: s.transactions.map((t) => (t.id === txId ? { ...t, installmentOverrides: overrides } : t)) }))
    get().showToast('이 회차 금액을 수정했어요')
    return { ok: true }
  },

  async deleteTransaction(txId) {
    const deletedType = (get().transactions.find((t) => t.id === txId) || {}).type
    const { error } = await sb.from('transactions').delete().eq('id', txId)
    if (error) {
      get().showToast('삭제 실패, 다시 시도해주세요')
      console.error(error)
      return { ok: false }
    }
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== txId) }))
    get().showToast(
      deletedType === 'transfer' ? '이체를 삭제했어요' : deletedType === 'income' ? '수입을 삭제했어요' : deletedType === 'settlement' ? '정산을 삭제했어요' : '지출을 삭제했어요',
    )
    return { ok: true }
  },

  // 추가수입(상여금/연주비/기타 등) 등록 후 "10%를 개인용돈에 적립할까요?" 확인 시 호출됨
  async addBonusToAllowance(amount, month, note) {
    const allowanceEnv = get().irregularEnvelopes.find((e) => e.scope === 'personal' && e.name === '개인 용돈')
    if (!allowanceEnv) {
      get().showToast('개인용돈 Envelope를 찾을 수 없어요')
      return
    }
    const row = { id: `bonus_${Date.now().toString(36)}`, envelopeId: allowanceEnv.id, month, amount, note }
    const { error } = await sb.from('envelope_bonus_credits').upsert(bonusCreditToRow(row))
    if (error) {
      get().showToast('개인용돈 적립 실패 (SQL 마이그레이션이 필요할 수 있어요)')
      console.error(error)
      return
    }
    set((s) => ({ envelopeBonusCredits: [...s.envelopeBonusCredits, row] }))
    get().showToast(`개인용돈에 ${amount.toLocaleString('ko-KR')}원을 적립했어요`)
  },

  findCatPool(catId) {
    const s = get()
    return findCatPool(catId, { livingCategories: s.livingCategories, irregularEnvelopes: s.irregularEnvelopes })
  },

  async upsertLivingBudgetRate(categoryId, effectiveMonth, amount) {
    await upsertRateChange(get, set, {
      list: get().livingBudgetChanges,
      listKey: 'livingBudgetChanges',
      table: 'living_budget_changes',
      toRow: budgetChangeToRow,
      idPrefix: 'lbc',
      keyField: 'categoryId',
      keyValue: categoryId,
      effectiveMonth,
      amount,
      failMsg: '예산 수정 실패 (SQL 마이그레이션이 필요할 수 있어요)',
      successMsg: `${effectiveMonth}부터 적용되는 예산을 수정했어요`,
    })
  },

  async upsertEnvelopeRate(envelopeId, effectiveMonth, amount) {
    await upsertRateChange(get, set, {
      list: get().envelopeRateChanges,
      listKey: 'envelopeRateChanges',
      table: 'envelope_rate_changes',
      toRow: rateChangeToRow,
      idPrefix: 'erc',
      keyField: 'envelopeId',
      keyValue: envelopeId,
      effectiveMonth,
      amount,
      failMsg: '충전액 수정 실패 (SQL 마이그레이션이 필요할 수 있어요)',
      successMsg: `${effectiveMonth}부터 적용되는 충전액을 수정했어요`,
    })
  },

  openSettingsSheet() {
    set({ settingsSheetOpen: true })
  },
  closeSettingsSheet() {
    set({ settingsSheetOpen: false })
  },

  nextColor() {
    const s = get()
    const c = PALETTE[s.nextColorIdx % PALETTE.length]
    set({ nextColorIdx: s.nextColorIdx + 1 })
    return c
  },

  addLivingCategory() {
    set((s) => ({
      livingCategories: [...s.livingCategories, { id: 'cat_' + Date.now().toString(36), name: '새 카테고리', color: get().nextColor(), limit: 0, subcats: [] }],
    }))
  },
  addIrregularEnvelope() {
    set((s) => ({
      irregularEnvelopes: [
        ...s.irregularEnvelopes,
        { id: 'irr_' + Date.now().toString(36), name: '새 누적 카테고리', color: get().nextColor(), monthlyAmount: 0, startMonth: monthKey(s.viewDate), subcats: [], scope: 'personal' },
      ],
    }))
  },
  addFixedExpense() {
    // startMonth를 지금 보고 있는 달로 고정해서, 새로 추가한 고정지출이 과거 달에까지 소급 적용되지 않게 한다
    // (기존 행은 startMonth가 없어서 하위호환으로 계속 처음부터 적용된 것으로 취급됨).
    set((s) => ({
      fixedExpenses: [...s.fixedExpenses, { id: 'fixed_' + Date.now().toString(36), name: '새 항목', amount: 0, startMonth: monthKey(s.viewDate) }],
    }))
  },
  addPayMethod() {
    set((s) => ({ payMethods: [...s.payMethods, { id: 'pay_' + Date.now().toString(36), name: '새 결제수단' }] }))
  },

  // 카테고리/봉투/고정지출/결제수단 삭제는 원본처럼 저장하기 버튼을 기다리지 않고 그 자리에서 바로 반영됨.
  async deleteLivingCategory(id) {
    if (get().livingCategories.length <= 1) {
      get().showToast('최소 1개는 있어야 해요')
      return { ok: false }
    }
    const { error } = await sb.from('living_categories').delete().eq('id', id)
    if (error) {
      get().showToast('삭제 실패')
      console.error(error)
      return { ok: false }
    }
    set((s) => ({ livingCategories: s.livingCategories.filter((c) => c.id !== id) }))
    return { ok: true }
  },
  async deleteIrregularEnvelope(id) {
    const { error } = await sb.from('irregular_envelopes').delete().eq('id', id)
    if (error) {
      get().showToast('삭제 실패')
      console.error(error)
      return { ok: false }
    }
    set((s) => ({ irregularEnvelopes: s.irregularEnvelopes.filter((c) => c.id !== id) }))
    return { ok: true }
  },
  async deleteFixedExpense(id) {
    const { error } = await sb.from('fixed_expenses').delete().eq('id', id)
    if (error) {
      get().showToast('삭제 실패')
      console.error(error)
      return { ok: false }
    }
    set((s) => ({ fixedExpenses: s.fixedExpenses.filter((f) => f.id !== id) }))
    return { ok: true }
  },
  async deletePayMethod(id) {
    const { error } = await sb.from('pay_methods').delete().eq('id', id)
    if (error) {
      get().showToast('삭제 실패')
      console.error(error)
      return { ok: false }
    }
    set((s) => ({ payMethods: s.payMethods.filter((p) => p.id !== id) }))
    return { ok: true }
  },

  // 고정지출의 금액/결제수단/할부 정보를 그 자리에서 바로 수정 (저장하기 버튼 안 기다림 — 예산 탭 카드 전용).
  async updateFixedExpense(id, patch) {
    const idx = get().fixedExpenses.findIndex((f) => f.id === id)
    if (idx === -1) return
    const updated = { ...get().fixedExpenses[idx], ...patch }
    const { error } = await sb.from('fixed_expenses').upsert(fixedToRow(updated, idx, get().household))
    if (error) {
      get().showToast('고정지출 수정 실패')
      console.error(error)
      return
    }
    set((s) => ({ fixedExpenses: s.fixedExpenses.map((f) => (f.id === id ? updated : f)) }))
    get().showToast('고정지출을 수정했어요')
  },

  // updateFixedExpense와 똑같이 upsert를 쓴다 — update()였을 때는 방금 추가만 하고 아직 "저장하기"를
  // 안 누른(= DB에 아직 없는) 고정지출에 마감을 누르면 0건 갱신으로 조용히 씹히는 문제가 있었다.
  async toggleFixedEnd(id) {
    const f = get().fixedExpenses.find((x) => x.id === id)
    if (!f) return
    const closing = !f.endMonth
    const newEndMonth = closing ? monthKey(get().viewDate) : null
    await get().updateFixedExpense(id, { endMonth: newEndMonth })
    get().showToast(closing ? '마감 처리했어요' : '마감을 취소했어요')
  },

  // 드래그로 순서 바꾼 뒤 확정된 id 순서를 로컬 배열 순서에 반영 (Supabase에는 저장하기 버튼을 눌러야 반영됨 — 원본과 동일)
  reorderList(listKey, orderedIds) {
    set((s) => {
      const byId = new Map(s[listKey].map((item) => [item.id, item]))
      return { [listKey]: orderedIds.map((id) => byId.get(id)).filter(Boolean) }
    })
  },

  // 설정 시트 "저장하기" — 5개 테이블을 한 번에 upsert. drafts는 SettingsSheet가 들고 있던 미저장 편집값.
  async saveSettings(drafts) {
    const s = get()
    const livingCategories = s.livingCategories.map((c) => ({ ...c, ...drafts.living[c.id] }))
    const irregularEnvelopes = s.irregularEnvelopes.map((e) => ({ ...e, ...drafts.irregular[e.id] }))
    const fixedExpenses = s.fixedExpenses.map((f) => ({ ...f, ...drafts.fixed[f.id] }))
    const payMethods = s.payMethods.map((p) => ({ ...p, ...drafts.pay[p.id] }))
    const incomeCategories = s.incomeCategories.map((c) => ({ ...c, ...drafts.income[c.id] }))

    const { error: e1 } = await sb.from('living_categories').upsert(livingCategories.map((c, i) => livingCatToRow(c, i, s.household)))
    const { error: e2 } = await sb.from('irregular_envelopes').upsert(irregularEnvelopes.map((e, i) => irregularToRow(e, i, s.household)))
    const { error: e3 } = await sb.from('fixed_expenses').upsert(fixedExpenses.map((f, i) => fixedToRow(f, i, s.household)))
    const { error: e4 } = await sb.from('pay_methods').upsert(payMethods.map((p, i) => payToRow(p, i)))
    let e5 = null
    if (s.household && incomeCategories.length) {
      const { error } = await sb.from('income_categories').upsert(incomeCategories.map((c, i) => incomeCatToRow(c, i, s.household)))
      e5 = error
    }
    if (e1 || e2 || e3 || e4 || e5) {
      get().showToast('저장 실패, 다시 시도해주세요')
      console.error(e1, e2, e3, e4, e5)
      return { ok: false }
    }
    set({ livingCategories, irregularEnvelopes, fixedExpenses, payMethods, incomeCategories, settingsSheetOpen: false })
    get().showToast('카테고리 설정을 저장했어요')
    return { ok: true }
  },

  async subscribeToPush() {
    if (Notification.permission === 'denied') {
      get().showToast('브라우저 알림 권한이 차단되어 있어요. 브라우저 설정에서 허용해주세요.')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      get().showToast('알림 권한을 허용해야 알림을 받을 수 있어요')
      return
    }

    const reg = await registerServiceWorker()
    if (!reg) {
      get().showToast('알림 등록에 실패했어요')
      return
    }

    let sub
    try {
      sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }))
    } catch (err) {
      console.error('push subscribe 실패', err)
      get().showToast('알림 구독에 실패했어요')
      return
    }

    const json = sub.toJSON()
    const row = { id: `push_${Date.now().toString(36)}`, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth_key: json.keys.auth }
    const { error } = await sb.from('push_subscriptions').upsert(row, { onConflict: 'user_id,endpoint' })
    if (error) {
      get().showToast('알림 구독 저장 실패 (SQL 마이그레이션이 필요할 수 있어요)')
      console.error(error)
      return
    }
    // notification_settings 기본값도 같이 저장해서 이후 Edge Function이 바로 참조할 수 있게 한다
    await sb.from('notification_settings').upsert(notifSettingsToRow(get().notificationSettings, get().myUserId), { onConflict: 'user_id' })
    set({ pushSubscribed: true })
    get().showToast('알림을 켰어요')
  },

  async unsubscribeFromPush() {
    try {
      const reg = await navigator.serviceWorker.getRegistration('./sw.js')
      const sub = reg && (await reg.pushManager.getSubscription())
      if (sub) {
        await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      } else {
        // 로컬 구독 정보가 없어도(다른 기기 등) 내 계정에 저장된 구독은 정리한다
        await sb.from('push_subscriptions').delete().eq('user_id', get().myUserId)
      }
    } catch (err) {
      console.error('unsubscribe 실패', err)
    }
    set({ pushSubscribed: false })
    get().showToast('알림을 껐어요')
  },

  async saveNotificationSettings(hour) {
    const notificationSettings = { ...get().notificationSettings, dailyReminderHour: hour }
    set({ notificationSettings })
    const { error } = await sb.from('notification_settings').upsert(notifSettingsToRow(notificationSettings, get().myUserId), { onConflict: 'user_id' })
    if (error) {
      get().showToast('알림 설정 저장 실패')
      console.error(error)
      return
    }
    get().showToast('알림 설정을 저장했어요')
  },

  showToast(message) {
    set({ toast: message })
  },
  clearToast() {
    set({ toast: null })
  },

  // 세션이 있는지 확인하고 있으면 부트스트랩까지 진행. init()과 onAuthStateChange(SIGNED_IN) 둘 다에서
  // 호출될 수 있어서, 이미 loading을 벗어난 상태면 재진입하지 않는다 (원본의 appStarted 플래그와 동일한 목적).
  async checkSession() {
    const { data } = await sb.auth.getSession()
    if (data.session) {
      await get().bootstrap()
    } else {
      set({ authStatus: 'signed-out' })
    }
  },

  async bootstrap() {
    if (get().authStatus !== 'loading' && get().authStatus !== 'signed-out') return
    set({ authStatus: 'loading' })
    await migratePersonalAllowance()
    const hhInfo = await resolveHousehold()
    if (hhInfo.v3Available && !hhInfo.household) {
      // SQL v3까지 적용됐는데 아직 소속 가계부가 없는 사용자 (예: 새로 가입한 배우자) → 설정 화면 표시
      set({ authStatus: 'needs-household', myUserId: hhInfo.myUserId })
      return
    }
    await get().finishStartup(hhInfo)
  },

  async finishStartup(hhInfo) {
    try {
      const loaded = await loadState(hhInfo.household, hhInfo.myUserId, hhInfo.members)
      const nextColorIdx = (loaded.livingCategories.length + loaded.irregularEnvelopes.length) % PALETTE.length
      set({ ...loaded, nextColorIdx, authStatus: 'ready' })
    } catch (err) {
      if (err instanceof SupabaseUnreachableError) {
        get().showToast('Supabase 연결에 실패했어요')
      }
      throw err
    }
  },

  async createHousehold(name) {
    const { error } = await sb.rpc('create_household', { p_name: name.trim() || '우리집 가계부' })
    if (error) return { ok: false, message: '가계부 생성 실패: ' + error.message }
    const hhInfo = await resolveHousehold()
    await get().finishStartup(hhInfo)
    return { ok: true }
  },

  async joinHousehold(code) {
    if (!code.trim()) return { ok: false, message: '초대 코드를 입력해주세요' }
    const { error } = await sb.rpc('join_household_by_code', { p_code: code.trim() })
    if (error) return { ok: false, message: '참여 실패: ' + error.message }
    const hhInfo = await resolveHousehold()
    await get().finishStartup(hhInfo)
    return { ok: true }
  },

  async signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return { ok: false, message: '로그인 실패: ' + error.message }
    return { ok: true }
  },

  async signUp(email, password) {
    const { error } = await sb.auth.signUp({ email: email.trim(), password })
    if (error) return { ok: false, message: '회원가입 실패: ' + error.message }
    return { ok: true, message: '가입 완료! 이메일 인증이 필요하면 확인 후 로그인해주세요.' }
  },

  async signOut() {
    await sb.auth.signOut()
  },
}))
