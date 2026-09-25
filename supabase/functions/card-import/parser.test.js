import { describe, expect, it } from 'vitest'
import { parseCardNotification } from './parser.ts'

describe('현대카드 알림 파서', () => {
  it('승인 금액, 카드, 시각과 일시불을 읽는다', () => {
    expect(parseCardNotification(
      '현대카드',
      '심성민 님, 현대 M BOOST 승인 27,200원 일시불, 9/25 18:10',
      new Date('2026-09-25T09:11:00.000Z'),
    )).toEqual({
      cardName: '현대 M BOOST',
      amount: 27200,
      occurredAt: '2026-09-25T09:10:00.000Z',
      installmentCount: null,
      approvalStatus: 'approved',
    })
  })

  it('할부와 승인 취소를 구분한다', () => {
    const result = parseCardNotification(
      '현대카드',
      '심성민 님, 현대 M BOOST 승인취소 197,000원 3개월, 9/25 18:10',
      new Date('2026-09-25T09:12:00.000Z'),
    )
    expect(result?.installmentCount).toBe(3)
    expect(result?.approvalStatus).toBe('cancelled')
  })

  it('카드 승인 형식이 아니면 거절한다', () => {
    expect(parseCardNotification('현대카드', '이번 달 혜택을 확인하세요')).toBeNull()
  })
})
