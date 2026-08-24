import { create } from 'zustand'
import { sb, PALETTE } from '../data/supabaseClient.js'
import { resolveHousehold, loadState, migratePersonalAllowance, SupabaseUnreachableError } from '../data/loadState.js'
import { budgetToRow, rateChangeToRow } from '../data/converters.js'
import { todayKST } from '../lib/calc.js'

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
  monthlyBudgets: [],
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
  ...initialData,

  shiftMonth(delta) {
    set((s) => ({ viewDate: new Date(s.viewDate.getFullYear(), s.viewDate.getMonth() + delta, 1) }))
  },
  setActiveCol(col) {
    set({ activeCol: col })
  },

  async upsertMonthlyBudget(categoryId, yearMonth, amount) {
    const existing = get().monthlyBudgets.find((b) => b.categoryId === categoryId && b.yearMonth === yearMonth)
    const row = { id: existing ? existing.id : `mb_${categoryId}_${yearMonth}`, categoryId, yearMonth, amount }
    const { error } = await sb.from('monthly_budgets').upsert(budgetToRow(row, get().household))
    if (error) {
      get().showToast('예산 수정 실패 (SQL 마이그레이션이 필요할 수 있어요)')
      console.error(error)
      return
    }
    set((s) => ({
      monthlyBudgets: existing
        ? s.monthlyBudgets.map((b) => (b === existing ? row : b))
        : [...s.monthlyBudgets, row],
    }))
    get().showToast(`${yearMonth} 예산을 수정했어요`)
  },

  async upsertEnvelopeRate(envelopeId, effectiveMonth, amount) {
    const existing = get().envelopeRateChanges.find((r) => r.envelopeId === envelopeId && r.effectiveMonth === effectiveMonth)
    const row = { id: existing ? existing.id : `erc_${envelopeId}_${effectiveMonth}`, envelopeId, effectiveMonth, amount }
    const { error } = await sb.from('envelope_rate_changes').upsert(rateChangeToRow(row))
    if (error) {
      get().showToast('충전액 수정 실패 (SQL 마이그레이션이 필요할 수 있어요)')
      console.error(error)
      return
    }
    set((s) => ({
      envelopeRateChanges: existing
        ? s.envelopeRateChanges.map((r) => (r === existing ? row : r))
        : [...s.envelopeRateChanges, row],
    }))
    get().showToast(`${effectiveMonth}부터 적용되는 충전액을 수정했어요`)
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
