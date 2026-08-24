import { sb } from './supabaseClient.js'
import { DEFAULT_STATE } from './defaultState.js'
import {
  rowToLivingCat,
  livingCatToRow,
  rowToIrregular,
  irregularToRow,
  rowToBudget,
  rowToRateChange,
  rowToIncomeCat,
  incomeCatToRow,
  rowToBonusCredit,
  rowToNotifSettings,
  rowToTx,
  rowToFixed,
  rowToPay,
  payToRow,
} from './converters.js'

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms))
}

// Supabase 연결 자체가 안 될 때 던지는 에러. 호출부(스토어)가 잡아서 토스트를 띄우고
// structuredClone(DEFAULT_STATE)로 폴백하면 된다 — 이 모듈은 UI에 관여하지 않는다.
export class SupabaseUnreachableError extends Error {
  constructor(errors) {
    super('Supabase 연결에 실패했어요')
    this.name = 'SupabaseUnreachableError'
    this.errors = errors
  }
}

async function fetchAllTables() {
  return Promise.all([
    sb.from('living_categories').select('*').order('sort_order'),
    sb.from('irregular_envelopes').select('*').order('sort_order'),
    sb.from('transactions').select('*').order('date'),
    sb.from('fixed_expenses').select('*').order('sort_order'),
    sb.from('pay_methods').select('*').order('sort_order'),
  ])
}

// household_members/households(SQL v3)가 아직 없으면(마이그레이션 전) household 기능은 조용히 건너뛰고
// 기존 v2(단일 사용자, user_id 기반 RLS) 방식 그대로 동작한다.
export async function resolveHousehold() {
  const { data: userData } = await sb.auth.getUser()
  const myUserId = userData && userData.user ? userData.user.id : null
  try {
    const { data: memberRows, error } = await sb.from('household_members').select('*').eq('user_id', myUserId)
    if (error) throw error
    if (!memberRows || !memberRows.length) return { household: null, myUserId, members: [], v3Available: true }
    const hid = memberRows[0].household_id
    const [{ data: hhRows }, { data: allMembers }] = await Promise.all([
      sb.from('households').select('*').eq('id', hid).limit(1),
      sb.from('household_members').select('*').eq('household_id', hid),
    ])
    const hh =
      hhRows && hhRows[0]
        ? { id: hhRows[0].id, name: hhRows[0].name, inviteCode: hhRows[0].invite_code }
        : { id: hid, name: '우리집 가계부', inviteCode: null }
    return {
      household: hh,
      myUserId,
      members: (allMembers || []).map((m) => ({ userId: m.user_id, role: m.role })),
      v3Available: true,
    }
  } catch (err) {
    console.warn('household_members 테이블을 아직 사용할 수 없어요 (SQL v3 마이그레이션 필요할 수 있음):', err)
    return { household: null, myUserId, members: [], v3Available: false }
  }
}

export async function loadState(household, myUserId, members) {
  let results = await fetchAllTables()
  let [
    { data: livingRows, error: e1 },
    { data: irrRows, error: e2 },
    { data: txRows, error: e3 },
    { data: fixedRows, error: e4 },
    { data: payRows, error: e5 },
  ] = results
  // 로그인 직후엔 세션 토큰이 아직 준비 안 됐을 수 있어서, 실패하면 잠깐 기다렸다 최대 2번 재시도
  let attempt = 0
  while ((e1 || e2 || e3 || e4 || e5) && attempt < 2) {
    attempt++
    await sleep(600)
    results = await fetchAllTables()
    ;[
      { data: livingRows, error: e1 },
      { data: irrRows, error: e2 },
      { data: txRows, error: e3 },
      { data: fixedRows, error: e4 },
      { data: payRows, error: e5 },
    ] = results
  }
  if (e1 || e2 || e3 || e4 || e5) {
    console.error(e1, e2, e3, e4, e5)
    throw new SupabaseUnreachableError([e1, e2, e3, e4, e5])
  }

  // id 컬럼들은 테이블 전체에서 유일해야 하는 primary key라, 'food'/'allowance' 같은 고정 문자열을
  // 그대로 쓰면 다른 계정이 이미 그 id를 쓰고 있을 때 씨딩이 충돌해서 실패한다. household/user가 있으면
  // (=v3 컨텍스트, 나 말고 다른 계정도 존재할 수 있음) id 뒤에 소유자 uuid 일부를 붙여 계정마다 유일하게 만든다.
  const idSuffix = (uid) => '_' + String(uid || '').replace(/-/g, '').slice(0, 10)
  const householdSuffix = household ? idSuffix(household.id) : ''
  const userSuffix = myUserId ? idSuffix(myUserId) : ''

  if (!livingRows.length && !irrRows.length && (!household || household.id)) {
    // 최초 1회: 기본값을 DB에 씨딩 (household가 있으면 household_id도 같이 찍힌다 - livingCatToRow/irregularToRow 참고)
    await sb.from('living_categories').insert(
      DEFAULT_STATE.livingCategories.map((c, i) => {
        const cat = household ? { ...c, id: c.id + householdSuffix } : c
        return livingCatToRow(cat, i, household)
      }),
    )
    await sb.from('irregular_envelopes').insert(
      DEFAULT_STATE.irregularEnvelopes.map((e, i) => {
        const suffix = household ? (e.scope === 'household' ? householdSuffix : userSuffix) : ''
        const env = suffix ? { ...e, id: e.id + suffix } : e
        const row = irregularToRow(env, i, household)
        if (env.scope === 'personal') row.user_id = myUserId
        return row
      }),
    )
  }
  if (!payRows.length) {
    // pay_methods 테이블이 비어있으면(신규 테이블 포함) 기본값 씨딩. pay_methods는 개인(user_id) 소유라 계정별로 id를 유일하게 만든다.
    await sb.from('pay_methods').insert(
      DEFAULT_STATE.payMethods.map((p, i) => {
        const pay = userSuffix ? { ...p, id: p.id + userSuffix } : p
        return payToRow(pay, i)
      }),
    )
  }

  // monthly_budgets는 SQL 마이그레이션을 아직 안 돌렸으면 테이블 자체가 없을 수 있어서 별도로, 실패해도 나머지 상태는 그대로 살린다
  let monthlyBudgets = []
  try {
    const { data: budgetRows, error: eBudget } = await sb.from('monthly_budgets').select('*')
    if (eBudget) throw eBudget
    monthlyBudgets = (budgetRows || []).map(rowToBudget)
  } catch (err) {
    console.warn('monthly_budgets 테이블을 아직 사용할 수 없어요 (SQL 마이그레이션 필요할 수 있음):', err)
  }

  // envelope_rate_changes도 마찬가지로 SQL 마이그레이션(STEP 4) 전이면 테이블이 없을 수 있어 별도 처리
  let envelopeRateChanges = []
  try {
    const { data: rateRows, error: eRate } = await sb.from('envelope_rate_changes').select('*')
    if (eRate) throw eRate
    envelopeRateChanges = (rateRows || []).map(rowToRateChange)
  } catch (err) {
    console.warn('envelope_rate_changes 테이블을 아직 사용할 수 없어요 (SQL 마이그레이션 필요할 수 있음):', err)
  }

  // envelope_bonus_credits (SQL v3)
  let envelopeBonusCredits = []
  try {
    const { data: bonusRows, error: eBonus } = await sb.from('envelope_bonus_credits').select('*')
    if (eBonus) throw eBonus
    envelopeBonusCredits = (bonusRows || []).map(rowToBonusCredit)
  } catch (err) {
    console.warn('envelope_bonus_credits 테이블을 아직 사용할 수 없어요 (SQL v3 마이그레이션 필요할 수 있음):', err)
  }

  // income_categories (SQL v3). household가 있는데 비어있으면 기본값(정기수입/추가수입) 씨딩
  let incomeCategories = []
  try {
    const { data: incomeRows, error: eIncome } = await sb.from('income_categories').select('*').order('sort_order')
    if (eIncome) throw eIncome
    if ((!incomeRows || !incomeRows.length) && household) {
      await sb
        .from('income_categories')
        .insert(DEFAULT_STATE.incomeCategories.map((c, i) => incomeCatToRow({ ...c, id: c.id + idSuffix(household.id) }, i, household)))
      const { data: seeded } = await sb.from('income_categories').select('*').order('sort_order')
      incomeCategories = (seeded || []).map(rowToIncomeCat)
    } else {
      incomeCategories = (incomeRows || []).map(rowToIncomeCat)
    }
  } catch (err) {
    console.warn('income_categories 테이블을 아직 사용할 수 없어요 (SQL v3 마이그레이션 필요할 수 있음):', err)
  }

  // notification_settings + push_subscriptions (SQL v4)
  let notificationSettings = structuredClone(DEFAULT_STATE.notificationSettings)
  let pushSubscribed = false
  try {
    const [{ data: notifRows, error: eNotif }, { data: subRows, error: eSub }] = await Promise.all([
      sb.from('notification_settings').select('*').limit(1),
      sb.from('push_subscriptions').select('id').limit(1),
    ])
    if (eNotif) throw eNotif
    if (notifRows && notifRows.length) notificationSettings = rowToNotifSettings(notifRows[0])
    if (!eSub) pushSubscribed = !!(subRows && subRows.length)
  } catch (err) {
    console.warn('notification_settings/push_subscriptions 테이블을 아직 사용할 수 없어요 (SQL v4 마이그레이션 필요할 수 있음):', err)
  }

  return {
    livingCategories: livingRows.length ? livingRows.map(rowToLivingCat) : structuredClone(DEFAULT_STATE.livingCategories),
    irregularEnvelopes: irrRows.length ? irrRows.map(rowToIrregular) : structuredClone(DEFAULT_STATE.irregularEnvelopes),
    transactions: txRows.map(rowToTx),
    fixedExpenses: fixedRows.map(rowToFixed),
    payMethods: payRows.length ? payRows.map(rowToPay) : structuredClone(DEFAULT_STATE.payMethods),
    monthlyBudgets,
    envelopeRateChanges,
    envelopeBonusCredits,
    incomeCategories: incomeCategories.length ? incomeCategories : household ? [] : structuredClone(DEFAULT_STATE.incomeCategories),
    household: household || null,
    myUserId: myUserId || null,
    householdMembers: members || [],
    notificationSettings,
    pushSubscribed,
  }
}

// 꾸밈비/문화·취미/비정기(경조사 제외)를 '개인 용돈' Envelope으로 통합하는 1회성 이관.
// 실제 이관 작업은 Postgres 함수(migrate_personal_allowance_v2)가 원자적으로 처리한다 (supabase/migration_v2_envelopes.sql).
// idempotent: 이미 이관된 계정이면 함수 내부에서 즉시 종료되고 아무것도 바뀌지 않는다.
// 반환값을 호출부가 보고 필요하면 토스트를 띄운다 (이 모듈은 UI에 관여하지 않음).
export async function migratePersonalAllowance() {
  const { error } = await sb.rpc('migrate_personal_allowance_v2')
  if (!error) return { ok: true }
  console.error('migratePersonalAllowance raw error:', JSON.stringify(error, null, 2))
  const missingFn =
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    /function .* does not exist/i.test(error.message || '') ||
    /schema cache/i.test(error.message || '')
  if (missingFn) {
    console.warn('migrate_personal_allowance_v2 RPC가 아직 없어요. supabase/migration_v2_envelopes.sql을 Supabase SQL Editor에서 먼저 실행해주세요.')
    return { ok: false, reason: 'missing_fn', error }
  }
  return { ok: false, reason: 'error', error }
}
