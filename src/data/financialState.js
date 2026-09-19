import { sb } from './supabaseClient.js'
import { rowToFixed, rowToFixedRateChange, rowToIrregular, rowToRateChange, rowToTx, rowToLivingCat, rowToBudgetChange, rowToBonusCredit } from './converters.js'

export async function loadHouseholdAllocations(household) {
  if (!household) return { householdAllocations: [], allocationsError: null }
  const { data, error } = await sb.rpc('household_envelope_allocations', { p_household_id: household.id })
  if (error) return { householdAllocations: [], allocationsError: '공동 월 충전액을 불러오지 못했어요. 연결 또는 공동 예산 설정을 확인해주세요.' }
  return { householdAllocations: data || [], allocationsError: null }
}

// 자동 갱신은 씨딩/마이그레이션 없이 읽기만 수행한다.
export async function loadFinancialState(household) {
  const tables = [
    ['fixedExpenses', 'fixed_expenses', rowToFixed],
    ['fixedRateChanges', 'fixed_expense_rate_changes', rowToFixedRateChange],
    ['irregularEnvelopes', 'irregular_envelopes', rowToIrregular],
    ['envelopeRateChanges', 'envelope_rate_changes', rowToRateChange],
    ['envelopeBonusCredits', 'envelope_bonus_credits', rowToBonusCredit],
    ['transactions', 'transactions', rowToTx],
    ['livingCategories', 'living_categories', rowToLivingCat],
    ['livingBudgetChanges', 'living_budget_changes', rowToBudgetChange],
  ]
  const results = await Promise.all(tables.map(([, table]) => {
    const query = sb.from(table).select('*')
    return ['fixed_expenses', 'irregular_envelopes', 'living_categories'].includes(table) ? query.order('sort_order') : query
  }))
  const failure = results.find((r) => r.error)
  if (failure) throw failure.error
  const allocations = await loadHouseholdAllocations(household)
  return { ...Object.fromEntries(tables.map(([key, , convert], i) => [key, results[i].data.map(convert)])), ...allocations }
}
