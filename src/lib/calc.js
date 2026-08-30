// 순수 계산 헬퍼 모음 — DOM/Supabase에 의존하지 않는다.
// 원본(vanilla index.html)에서는 전역 state 객체를 직접 읽었지만, 여기서는 필요한 배열을
// 파라미터로 받는다 (React 스토어의 selector에서 그대로 넘겨주면 됨).

export function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function nowMonthKey() {
  return todayKST().slice(0, 7)
}

export const fmt = (n) => Math.round(n || 0).toLocaleString('ko-KR')

export function fmtMan(n) {
  return (n / 10000).toFixed(1) + '만'
}

export function monthKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

export function elapsedMonths(startKey, viewKey) {
  const [sy, sm] = startKey.split('-').map(Number)
  const [vy, vm] = viewKey.split('-').map(Number)
  const diff = (vy - sy) * 12 + (vm - sm) + 1
  return Math.max(0, diff)
}

export function addMonths(monthKeyStr, delta) {
  const [y, m] = monthKeyStr.split('-').map(Number)
  const total = m - 1 + delta
  const ny = y + Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12 + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

// 할부 기본 월 금액: 마지막 회차는 반올림 오차를 몰아서 흡수해 합계가 원거래 금액과 정확히 일치하게 한다
export function installmentBaseAmount(t, idx) {
  const base = Math.round(t.amount / t.installmentCount)
  if (idx === t.installmentCount) return t.amount - base * (t.installmentCount - 1)
  return base
}

export function irregularContributions(transactions, envId, fromMonth, toMonth) {
  const records = []
  transactions.forEach((t) => {
    if (t.type !== 'irregular' || t.categoryId !== envId) return
    const subcat = t.subcat && t.subcat.trim() ? t.subcat.trim() : '기타'
    if (t.installmentCount && t.installmentCount > 1) {
      const originMonth = t.date.slice(0, 7)
      for (let idx = 1; idx <= t.installmentCount; idx++) {
        const mk = addMonths(originMonth, idx - 1)
        if (mk < fromMonth || mk > toMonth) continue
        const override = t.installmentOverrides && t.installmentOverrides[mk]
        const amount = override != null ? override : installmentBaseAmount(t, idx)
        records.push({ month: mk, amount, subcat })
      }
    } else {
      const mk = t.date.slice(0, 7)
      if (mk < fromMonth || mk > toMonth) return
      records.push({ month: mk, amount: t.amount, subcat })
    }
  })
  return records
}

export function fixedInstallmentIndex(f, viewKey) {
  if (!f.installmentCount) return null
  return elapsedMonths(f.installmentStartMonth, viewKey)
}

export function activeFixedExpenses(fixedExpenses, viewKey) {
  return fixedExpenses.filter((f) => {
    if (f.startMonth && viewKey < f.startMonth) return false
    if (f.endMonth && viewKey >= f.endMonth) return false
    if (!f.installmentCount) return true
    const idx = fixedInstallmentIndex(f, viewKey)
    return idx >= 1 && idx <= f.installmentCount
  })
}

export function isFixedActiveNow(f) {
  const vKey = nowMonthKey()
  if (f.startMonth && vKey < f.startMonth) return false
  if (f.endMonth && vKey >= f.endMonth) return false
  if (!f.installmentCount) return true
  const idx = fixedInstallmentIndex(f, vKey)
  return idx >= 1 && idx <= f.installmentCount
}

// 할부 거래를 해당 월에 보일 "가상 거래"로 펼친다. idx가 1~installmentCount 범위를 벗어나면 그 달엔 아예 안 보여야 한다
// (오늘 고친 "달력 하단 리스트가 안 지워지던" 버그와 같은 계열의 회귀를 막기 위한 경계 조건 — 아래 테스트로 고정해둔다).
export function expandMonthTx(transactions, viewKey) {
  const result = []
  transactions.forEach((t) => {
    if (t.installmentCount && t.installmentCount > 1) {
      const startKey = t.date.slice(0, 7)
      const idx = elapsedMonths(startKey, viewKey)
      if (idx < 1 || idx > t.installmentCount) return
      const override = t.installmentOverrides && t.installmentOverrides[viewKey]
      const amt = override != null ? override : installmentBaseAmount(t, idx)
      let virtualDate = t.date
      if (idx > 1) {
        const [vy, vm] = viewKey.split('-').map(Number)
        const lastDay = new Date(vy, vm, 0).getDate()
        const day = Math.min(parseInt(t.date.slice(8, 10), 10), lastDay)
        virtualDate = `${viewKey}-${String(day).padStart(2, '0')}`
      }
      result.push({ ...t, amount: amt, installmentIndex: idx, date: virtualDate })
    } else if (t.date.slice(0, 7) === viewKey) {
      result.push(t)
    }
  })
  return result
}

// 생활 카테고리의 특정 달 예산: 그 달 시점에 유효한 가장 최근 "이 달부터" 변경분이 있으면 그 값, 없으면 cat.limit(기본값)
// (누적 카테고리 monthlyAmountForMonth와 완전히 같은 방식 — "이번 달만 예외"가 아니라 "이 달부터 쭉" 변경)
export function budgetAmountForMonth(livingBudgetChanges, cat, yearMonth) {
  const applicable = livingBudgetChanges
    .filter((c) => c.categoryId === cat.id && c.effectiveMonth <= yearMonth)
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))
  return applicable.length ? applicable[applicable.length - 1].amount : cat.limit
}

// 누적 카테고리의 특정 달 충전액: 그 달 시점에 유효한 가장 최근 "이 달부터" 변경분이 있으면 그 값, 없으면 env.monthlyAmount(기본값)
export function monthlyAmountForMonth(envelopeRateChanges, env, yearMonth) {
  const applicable = envelopeRateChanges
    .filter((r) => r.envelopeId === env.id && r.effectiveMonth <= yearMonth)
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))
  return applicable.length ? applicable[applicable.length - 1].amount : env.monthlyAmount
}

// start_month부터 toMonth까지, 각 달마다 그 달 시점의 충전액을 적용해 누적 적립액을 합산하고,
// 그 기간에 들어온 1회성 보너스 적립(envelopeBonusCredits)도 더한다.
export function creditedForEnvelope(envelopeRateChanges, envelopeBonusCredits, env, fromMonth, toMonth) {
  let total = 0
  let m = fromMonth
  while (m <= toMonth) {
    total += monthlyAmountForMonth(envelopeRateChanges, env, m)
    m = addMonths(m, 1)
  }
  total += envelopeBonusCredits
    .filter((b) => b.envelopeId === env.id && b.month >= fromMonth && b.month <= toMonth)
    .reduce((s, b) => s + b.amount, 0)
  return total
}

// 정산(settlement): 특정 카테고리·달에 돌려받은 금액의 합. 원거래 금액은 절대 건드리지 않고,
// "실질 지출 = 실사용액 - 정산액" 계산에만 쓰인다.
export function settlementsForCategory(transactions, categoryId, yearMonth) {
  return transactions
    .filter((t) => t.type === 'settlement' && t.categoryId === categoryId && t.date.slice(0, 7) === yearMonth)
    .reduce((s, t) => s + t.amount, 0)
}

export function settlementsForCategoryRange(transactions, categoryId, fromMonth, toMonth) {
  return transactions
    .filter(
      (t) =>
        t.type === 'settlement' &&
        t.categoryId === categoryId &&
        t.date.slice(0, 7) >= fromMonth &&
        t.date.slice(0, 7) <= toMonth,
    )
    .reduce((s, t) => s + t.amount, 0)
}

// 분석 탭 내역 리스트 정렬 — date_desc가 기본값
export function sortTx(list, sort) {
  return [...list].sort((a, b) => {
    if (sort === 'date_asc') return (a.date + a.id).localeCompare(b.date + b.id)
    if (sort === 'amount_desc') return b.amount - a.amount
    if (sort === 'amount_asc') return a.amount - b.amount
    return (b.date + b.id).localeCompare(a.date + a.id)
  })
}
