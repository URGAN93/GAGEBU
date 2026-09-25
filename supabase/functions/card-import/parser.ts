const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function closestKstOccurrence(month: number, day: number, hour: number, minute: number, receivedAt: Date) {
  const receivedKst = new Date(receivedAt.getTime() + KST_OFFSET_MS)
  const baseYear = receivedKst.getUTCFullYear()
  const candidates = [baseYear - 1, baseYear, baseYear + 1].map(
    (year) => new Date(Date.UTC(year, month - 1, day, hour - 9, minute)),
  )
  return candidates.reduce((closest, candidate) =>
    Math.abs(candidate.getTime() - receivedAt.getTime()) < Math.abs(closest.getTime() - receivedAt.getTime()) ? candidate : closest,
  )
}
export type ParsedCardNotification = {
  cardName: string
  amount: number
  occurredAt: string
  installmentCount: number | null
  approvalStatus: 'approved' | 'cancelled'
}

export function parseCardNotification(title: string, text: string, receivedAt = new Date()): ParsedCardNotification | null {
  const body = String(text || '').trim()
  if (!body) return null

  const statusMatch = body.match(/승인\s*취소|승인취소|취소|승인/)
  const amountMatch = body.match(/([0-9][0-9,]*)\s*원/)
  const dateMatch = body.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/)
  if (!statusMatch || !amountMatch || !dateMatch) return null

  const beforeStatus = body.slice(0, statusMatch.index).replace(/^.*?님\s*,?\s*/, '').trim().replace(/[,\s]+$/, '')
  const cardName = beforeStatus || String(title || '').trim()
  if (!cardName) return null

  const amount = Number(amountMatch[1].replaceAll(',', ''))
  if (!(amount > 0)) return null

  const installmentMatch = body.match(/(\d{1,2})\s*개월/)
  const installmentValue = installmentMatch ? Number(installmentMatch[1]) : null
  const occurredAt = closestKstOccurrence(
    Number(dateMatch[1]),
    Number(dateMatch[2]),
    Number(dateMatch[3]),
    Number(dateMatch[4]),
    receivedAt,
  )

  return {
    cardName,
    amount,
    occurredAt: occurredAt.toISOString(),
    installmentCount: installmentValue && installmentValue > 1 ? installmentValue : null,
    approvalStatus: /취소/.test(statusMatch[0]) ? 'cancelled' : 'approved',
  }
}
