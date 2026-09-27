// state에서 파생되는 조회용 헬퍼 — 여러 화면(캘린더/분석/모달)에서 공유해서 쓴다.
import { incomeCategoryLabel } from './income.js'

export function findEnvelopeName(type, categoryId, { incomeCategories, livingCategories, irregularEnvelopes }) {
  if (type === 'income') {
    // 수입 거래는 household 공유, 설정은 개인 소유이므로 거래에는 공통 의미만 표시한다.
    // 계정별 suffix가 붙은 기존 id도 정기수입/추가수입 공통 id로 취급한다.
    const commonLabel = incomeCategoryLabel(categoryId)
    if (commonLabel) return commonLabel
    const ownCategory = incomeCategories.find((c) => c.id === categoryId)
    if (ownCategory) return ownCategory.name
    return '(삭제된 카테고리)'
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
