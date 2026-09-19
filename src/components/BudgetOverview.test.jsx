import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rowToLivingCat } from '../data/converters.js'
import Passbook from './Passbook.jsx'
import LivingEnvelopeCard from './LivingEnvelopeCard.jsx'
import BudgetScreen from '../screens/BudgetScreen.jsx'
import IrregularEnvelopeCard from './IrregularEnvelopeCard.jsx'

const { state } = vi.hoisted(() => ({ state: {} }))
vi.mock('../store/useAppStore.js', () => ({ useAppStore: (selector) => selector(state) }))
vi.mock('../lib/theme.js', () => ({ statusColor: () => '#3E7A55' }))

beforeEach(() => {
  Object.assign(state, {
    viewDate: new Date(2026, 8, 1),
    livingCategories: [{ id: 'food', name: '식비', limit: 1000000 },
      rowToLivingCat({ id: 'medical', name: '비정기 지출', default_amount: 0, budget_enabled: false, color: '#708090' })],
    irregularEnvelopes: [], livingBudgetChanges: [], envelopeRateChanges: [], fixedRateChanges: [],
    household: null, householdAllocations: [], allocationsError: null,
    fixedExpenses: [{ id: 'fixed', amount: 300000 }],
    transactions: [
      { type: 'living', categoryId: 'food', amount: 600000, date: '2026-09-01' },
      { type: 'living', categoryId: 'medical', amount: 200000, date: '2026-09-01' },
    ],
  })
})

describe('예산 화면 표시', () => {
  it('기존 고정지출과 두 사람 월 충전액을 함께 표시한다', () => {
    state.household = { id: 'home' }
    state.myUserId = 'me'
    state.householdAllocations = [
      { id: 'a', userId: 'me', name: '용돈', monthlyAmount: 300000 },
      { id: 'b', userId: 'me', name: '경조사', monthlyAmount: 200000 },
      { id: 'c', userId: 'wife', name: '용돈', monthlyAmount: 500000 },
      { id: 'd', userId: 'wife', name: '경조사', monthlyAmount: 200000 },
    ]
    const html = renderToStaticMarkup(<BudgetScreen />)
    expect(html).toContain('합계 1,500,000원')
    expect(html).toContain('나 · 용돈')
    expect(html).toContain('배우자 · 경조사')
    expect(html).toContain('<dt>고정</dt><dd>1,500,000')
    expect(html).toContain('잔여 400,000원')
  })

  it('추가 적립은 월 충전액을 바꾸지 않고 누적 잔액에만 보인다', () => {
    state.envelopeBonusCredits = [{ envelopeId: 'a', month: '2026-09', amount: 100000 }]
    const html = renderToStaticMarkup(<IrregularEnvelopeCard env={{ id: 'a', name: '용돈', monthlyAmount: 300000, startMonth: '2026-09' }} vKey="2026-09" />)
    expect(html).toContain('400,000원')
    expect(html).toContain('월 충전 300,000원')
    expect(html).toContain('이번 달 추가 적립 +100,000원 · 고정지출 제외')
  })
  it('공동 충전액 조회 실패 시 불완전한 총액을 표시하지 않는다', () => {
    state.allocationsError = '공동 월 충전액을 불러오지 못했어요.'
    const html = renderToStaticMarkup(<Passbook />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('다시 불러오기')
    expect(html).not.toContain('예상 지출 <strong>')
    expect(html).toContain('생활 예산')
  })
  it('실지출을 먼저 표시하고 비정기와 고정지출을 예산 사용액과 분리한다', () => {
    const html = renderToStaticMarkup(<Passbook />)
    expect(html).toContain('이번 달 가계 지출')
    expect(html.indexOf('이번 달 가계 지출')).toBeLessThan(html.indexOf('aria-label="생활 예산"'))
    expect(html).toContain('1,100,000')
    expect(html).toContain('<dt>비정기</dt><dd>200,000')
    expect(html).toContain('잔여 400,000원')
    expect(html).toContain('예상 지출 <strong>1,500,000원</strong>')
    expect(html).not.toContain('비정기 별도')
  })

  it.each([0, 200000])('비정기 지출이 %i원이어도 한도·잔여·초과·예산 편집을 표시하지 않는다', (amount) => {
    const cat = { ...state.livingCategories[1], name: '병원과 구독' }
    const html = renderToStaticMarkup(<LivingEnvelopeCard cat={cat} catTx={[{ amount }]} vKey="2026-09" />)
    expect(html).toContain('병원과 구독')
    expect(html).toContain('예산 없음')
    expect(html).toContain('이번 달 실부담')
    for (const unexpected of ['더 쓸 수', '초과했어요', 'env-bar', 'mr-budget-edit', '/ 0원']) {
      expect(html).not.toContain(unexpected)
    }
  })

  it('정산은 총지출과 비정기 실부담만 줄이고 생활 예산 잔액은 유지한다', () => {
    state.transactions.push({ type: 'settlement', categoryId: 'medical', amount: 120000, date: '2026-09-03' })
    const html = renderToStaticMarkup(<Passbook />)
    expect(html).toContain('980,000')
    expect(html).toContain('예상 지출 <strong>1,380,000원</strong>')
    expect(html).toContain('<dt>비정기</dt><dd>80,000')
    expect(html).toContain('잔여 400,000원')
  })

  it('생활 총액 초과는 상단 생활 칸과 생활 예산 카드에 표시한다', () => {
    state.transactions[0].amount = 1100000
    const html = renderToStaticMarkup(<Passbook />)
    expect(html).toContain('summary-over-budget')
    expect(html).toContain('100,000원 초과')
    expect(html).toContain('monthly-budget is-over-budget')
    expect(html).toContain('110% 사용')
    expect(html).toContain('예상 지출 <strong>1,600,000원</strong>')
  })

  it('카테고리만 초과하면 해당 카드에만 경고하고 생활 총액은 경고하지 않는다', () => {
    const cat = { id: 'food', name: '식비', limit: 500000 }
    state.livingCategories = [cat, { id: 'other', limit: 500000 }, state.livingCategories[1]]
    const card = renderToStaticMarkup(<LivingEnvelopeCard cat={cat} catTx={[{ amount: 600000 }]} vKey="2026-09" />)
    expect(card).toContain('is-over-budget')
    expect(card).toContain('예산 초과')
    expect(card).toContain('100,000원')
    expect(renderToStaticMarkup(<Passbook />)).not.toContain('summary-over-budget')
  })

  it('예산이 0원인 일반 카테고리도 지출하면 초과로 표시한다', () => {
    const cat = { id: 'food', name: '식비', limit: 0 }
    state.livingCategories = [cat, state.livingCategories[1]]
    const card = renderToStaticMarkup(<LivingEnvelopeCard cat={cat} catTx={[{ amount: 600000 }]} vKey="2026-09" />)
    expect(card).toContain('예산 초과')
    expect(card).toContain('width:100%')
    const html = renderToStaticMarkup(<Passbook />)
    expect(html).toContain('예산 초과')
    expect(html).not.toContain('0% 사용')
  })
})

// 필요할 때만 실제 컴포넌트와 CSS로 로컬 시안 파일을 만들어 육안 검사한다.
it('선택적으로 UI 확인용 예시를 렌더링한다', async () => {
  if (!process.env.GAGEBU_PREVIEW_PATH) return
  const { writeFile, readFile } = await import('node:fs/promises')
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8')
  const cat = state.livingCategories[1]
  const html = renderToStaticMarkup(<><Passbook /><h3>생활 카테고리</h3><LivingEnvelopeCard cat={cat} catTx={state.transactions.filter((t) => t.categoryId === cat.id)} vKey="2026-09" /></>)
  await writeFile(process.env.GAGEBU_PREVIEW_PATH, `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>가계부 UI 확인</title><style>${css}</style><body><main style="max-width:390px;padding:20px 16px;margin:auto"><p>2026년 9월 · 예시 데이터</p>${html}</main></body></html>`)
})
