// CSS 커스텀 프로퍼티(index.css의 --over/--warn/--ok)를 읽는 헬퍼.
// DOM에 의존하므로 순수 계산 모음인 calc.js와는 분리해뒀다.
export function statusColor(pct) {
  const styles = getComputedStyle(document.documentElement)
  if (pct >= 100) return styles.getPropertyValue('--over').trim()
  if (pct >= 80) return styles.getPropertyValue('--warn').trim()
  return styles.getPropertyValue('--ok').trim()
}
