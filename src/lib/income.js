export const INCOME_REGULAR_ID = 'income_regular'
export const INCOME_EXTRA_ID = 'income_extra'

export function incomeCategoryKind(categoryOrId) {
  const id = typeof categoryOrId === 'string' ? categoryOrId : categoryOrId?.id
  const name = typeof categoryOrId === 'string' ? '' : categoryOrId?.name
  if (id === INCOME_REGULAR_ID || id?.startsWith(`${INCOME_REGULAR_ID}_`) || name === '정기수입') return 'regular'
  if (id === INCOME_EXTRA_ID || id?.startsWith(`${INCOME_EXTRA_ID}_`) || name === '추가수입') return 'extra'
  return null
}

export function normalizeIncomeCategoryId(categoryOrId) {
  const kind = incomeCategoryKind(categoryOrId)
  if (kind === 'regular') return INCOME_REGULAR_ID
  if (kind === 'extra') return INCOME_EXTRA_ID
  return typeof categoryOrId === 'string' ? categoryOrId : categoryOrId?.id
}

export function incomeCategoryLabel(categoryOrId) {
  const kind = incomeCategoryKind(categoryOrId)
  if (kind === 'regular') return '정기수입'
  if (kind === 'extra') return '추가수입'
  return null
}

export function incomeAllowanceCreditId(transactionId) {
  return `bonus_income_${transactionId}`
}

export function calculateIncomeAllowance(amount, mode, value) {
  const numericAmount = Number(amount) || 0
  const numericValue = Number(value) || 0
  if (numericAmount <= 0 || numericValue <= 0) return 0
  if (mode === 'amount') return Math.min(numericAmount, Math.round(numericValue))
  return Math.min(numericAmount, Math.round(numericAmount * (Math.min(100, numericValue) / 100)))
}

export function encodeIncomeAllowanceNote({ transactionId, mode, value, label }) {
  return JSON.stringify({ source: 'income', transactionId, mode, value: Number(value), label: label || '추가수입' })
}

export function parseIncomeAllowanceNote(note) {
  if (!note || note[0] !== '{') return null
  try {
    const parsed = JSON.parse(note)
    if (parsed.source !== 'income' || !parsed.transactionId) return null
    return parsed
  } catch {
    return null
  }
}

// 신규 연결 기록을 우선하고, 기존 팝업 방식 기록은 정확히 하나만 일치할 때만 연결 대상으로 삼는다.
export function findIncomeAllowanceCredit(transaction, credits = []) {
  if (!transaction) return null
  const deterministicId = incomeAllowanceCreditId(transaction.id)
  const direct = credits.find((credit) => credit.id === deterministicId || parseIncomeAllowanceNote(credit.note)?.transactionId === transaction.id)
  if (direct) {
    const metadata = parseIncomeAllowanceNote(direct.note)
    return { credit: direct, mode: metadata?.mode || 'amount', value: metadata?.value ?? direct.amount }
  }

  const label = transaction.merchant || transaction.subcat || '추가수입'
  const month = transaction.date?.slice(0, 7)
  const matches = credits.flatMap((credit) => {
    if (credit.month !== month || !credit.note?.startsWith(`${label} `)) return []
    const match = credit.note.match(/ ([0-9]+(?:\.[0-9]+)?)%$/)
    if (!match) return []
    const percent = Number(match[1])
    return calculateIncomeAllowance(transaction.amount, 'percent', percent) === credit.amount
      ? [{ credit, mode: 'percent', value: percent }]
      : []
  })
  return matches.length === 1 ? matches[0] : null
}
