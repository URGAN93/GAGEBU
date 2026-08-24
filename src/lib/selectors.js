// state에서 파생되는 조회용 헬퍼 — 여러 화면(캘린더/분석/모달)에서 공유해서 쓴다.

export function findEnvelopeName(type, categoryId, { incomeCategories, livingCategories, irregularEnvelopes }) {
  if (type === 'income') {
    return (incomeCategories.find((c) => c.id === categoryId) || {}).name || '(삭제된 카테고리)'
  }
  // settlement은 living/irregular 어느 쪽이든 연결될 수 있어서 둘 다 찾아본다
  const found = livingCategories.find((c) => c.id === categoryId) || irregularEnvelopes.find((c) => c.id === categoryId)
  return found ? found.name : '(삭제된 카테고리)'
}

export function findCatPool(catId, { livingCategories, irregularEnvelopes }) {
  if (livingCategories.some((c) => c.id === catId)) return 'living'
  if (irregularEnvelopes.some((c) => c.id === catId)) return 'irregular'
  return null
}
