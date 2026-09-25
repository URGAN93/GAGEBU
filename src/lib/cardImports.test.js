import { describe, expect, it } from 'vitest'
import { importedPaymentDate, importedPaymentDraft, importedPaymentLabel, matchImportedCard } from './cardImports.js'

const payMethods = [
  { id: 'hyundai', name: '현대카드' },
  { id: 'samsung-tap', name: '삼성tap카드' },
  { id: 'samsung-benefit', name: '삼성benefit카드' },
]

describe('카드 알림 가져오기', () => {
  it('알림 카드명을 하나의 커스텀 결제수단에 자동 매칭한다', () => {
    expect(matchImportedCard('현대 M BOOST', payMethods)).toBe('현대카드')
    expect(matchImportedCard('삼성 tap 승인', payMethods)).toBe('삼성tap카드')
  })

  it('같은 카드사 후보가 여럿이면 억지로 매칭하지 않는다', () => {
    expect(matchImportedCard('삼성카드', payMethods)).toBeNull()
  })

  it('자동 입력용 거래 초안을 만든다', () => {
    expect(importedPaymentDraft({
      id: 'pending-1',
      cardName: '현대 M BOOST',
      amount: 27200,
      occurredAt: '2026-09-25T18:10:00+09:00',
      installmentCount: null,
    }, payMethods)).toEqual({
      pendingPaymentId: 'pending-1',
      amount: 27200,
      date: '2026-09-25',
      payMethod: '현대카드',
      installmentCount: null,
    })
    expect(importedPaymentLabel({ installmentCount: 3 })).toBe('3개월 할부')
  })

  it('UTC 시각을 한국 결제일로 바꾼다', () => {
    expect(importedPaymentDate('2026-09-24T16:10:00.000Z')).toBe('2026-09-25')
  })
})
