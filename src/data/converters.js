// Supabase row ↔ 앱 모델 변환 함수들.
// 원본(vanilla index.html)에서는 전역 state.household를 직접 읽었지만, 여기서는 household를
// 명시적 파라미터로 받는다 — 순수 함수로 만들어야 테스트/재사용이 쉬워진다.
// household/personal/per-user 스코핑 규칙은 원본 그대로 보존 (임의로 "정리"하지 않음).

export function rowToLivingCat(r) {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    limit: r.default_amount != null ? r.default_amount : r.limit_amount,
    subcats: r.subcats || [],
    householdId: r.household_id || null,
  }
}

export function livingCatToRow(c, idx, household) {
  const row = {
    id: c.id,
    name: c.name,
    color: c.color,
    default_amount: c.limit,
    limit_amount: c.limit,
    subcats: c.subcats || [],
    sort_order: idx,
  }
  if (household) row.household_id = c.householdId || household.id
  return row
}

export function rowToIrregular(r) {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    monthlyAmount: r.monthly_amount,
    startMonth: r.start_month,
    subcats: r.subcats || [],
    scope: r.scope || 'personal',
    householdId: r.household_id || null,
    userId: r.user_id || null,
  }
}

export function irregularToRow(e, idx, household) {
  const row = {
    id: e.id,
    name: e.name,
    color: e.color,
    monthly_amount: e.monthlyAmount,
    start_month: e.startMonth,
    subcats: e.subcats || [],
    sort_order: idx,
  }
  if (household) {
    row.scope = e.scope || 'personal'
    // irregular_envelopes.user_id는 NOT NULL 컬럼이라 household-scope여도 null로 지우지 않는다
    // (RLS의 household 분기는 user_id를 참조하지 않아서 값이 남아있어도 접근 제어엔 영향 없음)
    if (row.scope === 'household') {
      row.household_id = e.householdId || household.id
    } else {
      row.household_id = null
    }
  }
  return row
}

export function rowToBudgetChange(r) {
  return { id: r.id, categoryId: r.category_id, effectiveMonth: r.effective_month, amount: r.amount }
}

export function budgetChangeToRow(b, household) {
  const row = { id: b.id, category_id: b.categoryId, effective_month: b.effectiveMonth, amount: b.amount }
  if (household) row.household_id = household.id
  return row
}

export function rowToRateChange(r) {
  return { id: r.id, envelopeId: r.envelope_id, effectiveMonth: r.effective_month, amount: r.monthly_amount }
}

export function rateChangeToRow(r) {
  return { id: r.id, envelope_id: r.envelopeId, effective_month: r.effectiveMonth, monthly_amount: r.amount }
}

export function rowToIncomeCat(r) {
  return { id: r.id, name: r.name, color: r.color, subcats: r.subcats || [] }
}

export function incomeCatToRow(c, idx, household) {
  const row = { id: c.id, name: c.name, color: c.color, subcats: c.subcats || [], sort_order: idx }
  if (household) row.household_id = household.id
  return row
}

export function rowToBonusCredit(r) {
  return { id: r.id, envelopeId: r.envelope_id, month: r.month, amount: r.amount, note: r.note || null }
}

export function bonusCreditToRow(b) {
  return { id: b.id, envelope_id: b.envelopeId, month: b.month, amount: b.amount, note: b.note || null }
}

// 카테고리(생활 or 누적)의 household_id: 생활 카테고리와 scope='household' 누적 카테고리는 가계부 공유,
// scope='personal' 누적 카테고리(개인용돈 등)는 배우자에게 안 보이도록 null 유지
export function categoryHouseholdId(categoryId, { household, irregularEnvelopes, livingCategories, incomeCategories }) {
  const env = irregularEnvelopes.find((e) => e.id === categoryId)
  if (env) return env.scope === 'household' ? (household && household.id) || null : null
  if (livingCategories.some((c) => c.id === categoryId)) return (household && household.id) || null
  if (incomeCategories.some((c) => c.id === categoryId)) return (household && household.id) || null
  return null
}

export function rowToTx(r) {
  return {
    id: r.id,
    type: r.type,
    amount: r.amount,
    merchant: r.merchant,
    categoryId: r.category_id,
    subcat: r.subcat,
    payMethod: r.pay_method,
    fromId: r.from_id,
    toId: r.to_id,
    date: r.date,
    isRecurring: r.is_recurring || false,
    installmentCount: r.installment_count || null,
    installmentOverrides: r.installment_overrides || null,
    userId: r.user_id || null,
  }
}

export function txToRow(t, categoryScope) {
  const row = {
    id: t.id,
    type: t.type,
    amount: t.amount,
    merchant: t.merchant || null,
    category_id: t.categoryId || null,
    subcat: t.subcat || null,
    pay_method: t.payMethod || null,
    from_id: t.fromId || null,
    to_id: t.toId || null,
    date: t.date,
    is_recurring: !!t.isRecurring,
    installment_count: t.installmentCount || null,
    installment_overrides: t.installmentOverrides || null,
  }
  // categoryScope: { household, irregularEnvelopes, livingCategories, incomeCategories } — household가 있을 때만 넘겨준다
  if (categoryScope) {
    row.household_id = t.categoryId ? categoryHouseholdId(t.categoryId, categoryScope) : null
  }
  return row
}

export function rowToFixed(r) {
  return {
    id: r.id,
    name: r.name,
    amount: r.amount,
    payDay: r.pay_day,
    payMethod: r.pay_method,
    installmentCount: r.installment_count || null,
    installmentStartMonth: r.installment_start_month || null,
    startMonth: r.start_month || null,
    endMonth: r.end_month || null,
  }
}

export function fixedToRow(f, idx, household) {
  const row = {
    id: f.id,
    name: f.name,
    amount: f.amount,
    pay_day: f.payDay || null,
    pay_method: f.payMethod || null,
    sort_order: idx,
    installment_count: f.installmentCount || null,
    installment_start_month: f.installmentStartMonth || null,
    start_month: f.startMonth || null,
    end_month: f.endMonth || null,
  }
  if (household) row.household_id = household.id
  return row
}

export function rowToPay(r) {
  return { id: r.id, name: r.name }
}

export function payToRow(p, idx) {
  return { id: p.id, name: p.name, sort_order: idx }
}
