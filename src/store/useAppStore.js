import { create } from 'zustand'
import { sb, PALETTE } from '../data/supabaseClient.js'
import { resolveHousehold, loadState, migratePersonalAllowance, SupabaseUnreachableError } from '../data/loadState.js'

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
  ...initialData,

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
