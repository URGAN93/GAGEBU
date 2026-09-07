// 커스텀 숫자 키패드(AmountKeypad)가 공유하는 순수 함수들.
// 값은 앞에 '-'가 붙을 수 있는 숫자 문자열로 표현한다 (예: '', '1200', '-500').

export function appendDigit(raw, digit) {
  const neg = raw.startsWith('-')
  const digits = ((neg ? raw.slice(1) : raw) + digit).replace(/^0+(?=\d)/, '').slice(0, 12)
  return (neg ? '-' : '') + digits
}

export function backspaceAmount(raw) {
  if (raw.length <= 1) return ''
  const next = raw.slice(0, -1)
  return next === '-' ? '' : next
}

export function toggleSign(raw) {
  if (!raw) return raw
  return raw.startsWith('-') ? raw.slice(1) : '-' + raw
}

export function formatAmountDisplay(raw, unit = '원') {
  if (!raw || raw === '-') return `0${unit}`
  const neg = raw.startsWith('-')
  const digits = neg ? raw.slice(1) : raw
  const num = digits ? Number(digits) : 0
  return `${neg ? '-' : ''}${num.toLocaleString('ko-KR')}${unit}`
}
