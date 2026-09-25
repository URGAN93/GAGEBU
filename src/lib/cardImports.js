function normalizeCardName(value) {
  return String(value || '')
    .toLocaleLowerCase('ko-KR')
    .replace(/(신용|체크)?카드/g, '')
    .replace(/[^0-9a-z가-힣]/g, '')
}

export function importedPaymentDate(occurredAt) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(occurredAt))
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function matchImportedCard(detectedName, payMethods) {
  const detected = normalizeCardName(detectedName)
  if (!detected) return null

  const matches = payMethods.filter((method) => {
    const saved = normalizeCardName(method.name)
    return saved && (detected.includes(saved) || saved.includes(detected))
  })

  return matches.length === 1 ? matches[0].name : null
}

export function importedPaymentDraft(payment, payMethods) {
  return {
    pendingPaymentId: payment.id,
    amount: payment.amount,
    date: importedPaymentDate(payment.occurredAt),
    payMethod: matchImportedCard(payment.cardName, payMethods),
    installmentCount: payment.installmentCount > 1 ? payment.installmentCount : null,
  }
}

export function importedPaymentLabel(payment) {
  if (payment.installmentCount > 1) return `${payment.installmentCount}개월 할부`
  return '일시불'
}
