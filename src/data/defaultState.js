import { nowMonthKey } from '../lib/calc.js'
import { PALETTE } from './supabaseClient.js'

// 신규 계정/가구에 처음 시딩되는 기본값. loadState()가 DB가 비어있을 때 이 값을 그대로 insert한다.
export const DEFAULT_STATE = {
  // living 카테고리의 limit은 "기본 예산(default_amount)"이며, 월별 override는 state.monthlyBudgets에 별도 저장된다.
  livingCategories: [
    { id: 'food', name: '식비', color: PALETTE[0], limit: 600000, subcats: ['배달음식', '점심', '커피', '외식', '간식'] },
    { id: 'living', name: '생활비', color: PALETTE[1], limit: 300000, subcats: [] },
    { id: 'transport', name: '교통', color: PALETTE[4], limit: 400000, subcats: [] },
    { id: 'etc', name: '기타', color: PALETTE[5], limit: 100000, subcats: [] },
  ],
  // 비정기 카테고리 = 누적형 Envelope(Sinking Fund): 매달 monthlyAmount만큼 적립, 안 쓰면 이월
  // scope: 'household'=가계부 구성원 전체 공유(경조사), 'personal'=본인만(개인용돈)
  irregularEnvelopes: [
    {
      id: 'irregular1',
      name: '경조사',
      color: PALETTE[6],
      monthlyAmount: 200000,
      startMonth: nowMonthKey(),
      subcats: ['경조사', '가족선물'],
      scope: 'household',
    },
    {
      id: 'allowance',
      name: '개인 용돈',
      color: PALETTE[2],
      monthlyAmount: 500000,
      startMonth: nowMonthKey(),
      subcats: ['꾸밈', '문화·취미', '의류', '자동차', '생활용품', '여행', '기타'],
      scope: 'personal',
    },
  ],
  transactions: [],
  fixedExpenses: [],
  payMethods: [
    { id: 'pay_hyundai', name: '현대카드' },
    { id: 'pay_shinhan', name: '신한카드' },
    { id: 'pay_kb', name: '국민카드' },
    { id: 'pay_cash', name: '현금' },
    { id: 'pay_kakao', name: '카카오페이' },
    { id: 'pay_etc', name: '기타' },
  ],
  incomeCategories: [
    { id: 'income_regular', name: '정기수입', color: PALETTE[0], subcats: ['급여', '교회페이'] },
    { id: 'income_extra', name: '추가수입', color: PALETTE[3], subcats: ['상여금', '연주비', '기타'] },
  ],
  monthlyBudgets: [],
  envelopeRateChanges: [],
  envelopeBonusCredits: [],
}
