import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import {
  activeFixedExpenses,
  addMonths,
  expandMonthTx,
  fmt,
  monthKey,
  monthlyClosingSummary,
} from '../lib/calc.js'
import { useEnvelopeFixedExpenses } from '../hooks/useEnvelopeFixedExpenses.js'
import AnalysisScreen from './AnalysisScreen.jsx'

export default function ClosingScreen() {
  const viewDate = useAppStore((s) => s.viewDate)
  const transactions = useAppStore((s) => s.transactions)
  const fixedExpenses = useAppStore((s) => s.fixedExpenses)
  const fixedRateChanges = useAppStore((s) => s.fixedRateChanges)
  const irregularEnvelopes = useAppStore((s) => s.irregularEnvelopes)
  const householdMembers = useAppStore((s) => s.householdMembers)
  const myUserId = useAppStore((s) => s.myUserId)
  const payMethods = useAppStore((s) => s.payMethods)
  const allocationsError = useAppStore((s) => s.allocationsError)

  const vKey = monthKey(viewDate)
  const nextVKey = addMonths(vKey, 1)
  const monthTx = useMemo(() => expandMonthTx(transactions, vKey), [transactions, vKey])
  const currentFixed = useMemo(() => activeFixedExpenses(fixedExpenses, vKey), [fixedExpenses, vKey])
  const nextFixed = useMemo(() => activeFixedExpenses(fixedExpenses, nextVKey), [fixedExpenses, nextVKey])
  const nextEnvelopeFixed = useEnvelopeFixedExpenses(nextVKey)
  const nextMonthLabel = `${Number(nextVKey.slice(5, 7))}월`
  const otherLabel = (() => {
    try {
      return localStorage.getItem('payOwnerOtherLabel') || '김다솔'
    } catch {
      return '김다솔'
    }
  })()

  const summary = monthlyClosingSummary({
    monthTx,
    currentFixed,
    nextFixed,
    fixedRateChanges,
    nextEnvelopeFixed,
    irregularEnvelopes,
    householdMembers,
    myUserId,
    myPayMethods: payMethods,
  }, vKey)

  return (
    <div className="col-closing">
      {allocationsError ? (
        <p role="alert">공동 충전액을 확인하지 못해 마감 금액을 계산할 수 없어요.</p>
      ) : summary.isOwnerView ? (
        <>
          <section className="payment-ready closing-overview" aria-label="월 마감">
            <div className="payment-ready-head">
              <div>
                <div className="payment-ready-eyebrow">{Number(vKey.slice(5, 7))}월 월 마감</div>
                <div className="payment-ready-amount">{fmt(summary.salaryReserveTotal)}원</div>
                <div className="payment-ready-caption">다음 달 준비금 · 보관금 제외</div>
              </div>
              <div className="payment-ready-badge">{nextMonthLabel} 준비</div>
            </div>
            <div className="payment-ready-rows">
              <div className="closing-section-title">{Number(vKey.slice(5, 7))}월 내 카드 결제 준비</div>
              <div className="closing-card-equation" aria-label="내 카드 결제 준비 계산">
                <div>
                  <span>결제 예정액</span>
                  <b>{fmt(summary.cardChargeTotal)}원</b>
                </div>
                <i>−</i>
                <div>
                  <span>이미 보관 중</span>
                  <b>{fmt(summary.reservedTotal)}원</b>
                </div>
                <i>=</i>
                <div className="result">
                  <span>추가 입금액</span>
                  <b>{fmt(summary.cardTopUp)}원</b>
                </div>
              </div>
              <div className="payment-ready-row detail">
                <span>정산금 {fmt(summary.settlementReserve)} · 내 용돈 카드 {fmt(summary.ownerAllowanceReserve)}</span>
              </div>
              <div className="closing-section-title">{nextMonthLabel} 생활 준비</div>
              <div className="payment-ready-row">
                <span>현금성 고정지출</span>
                <b>{fmt(summary.nextImmediateFixed)}원</b>
              </div>
              {householdMembers.length > 1 && (
                <div className="payment-ready-row">
                  <span>{otherLabel}이 결제한 가계 사용분</span>
                  <b>{fmt(summary.spouseUsage)}원</b>
                </div>
              )}
              {summary.nextSpouseAllowance > 0 && (
                <div className="payment-ready-row">
                  <span>{otherLabel} 용돈</span>
                  <b>{fmt(summary.nextSpouseAllowance)}원</b>
                </div>
              )}
              {summary.nextOwnerAllowance > 0 && (
                <div className="payment-ready-row">
                  <span>심성민 용돈</span>
                  <b>{fmt(summary.nextOwnerAllowance)}원</b>
                </div>
              )}
              <div className="payment-ready-row">
                <span>경조사비</span>
                <b>{fmt(summary.nextEventFund)}원</b>
              </div>
              <div className="payment-ready-row total">
                <span>{nextMonthLabel} 생활 준비 합계</span>
                <b>{fmt(summary.nextLivingPrepTotal)}원</b>
              </div>
            </div>
            <div className="closing-reserve-composition">
              <div>
                <span>내 카드 결제 추가 입금</span>
                <b>{fmt(summary.cardTopUp)}원</b>
              </div>
              <i>+</i>
              <div>
                <span>{nextMonthLabel} 생활 준비</span>
                <b>{fmt(summary.nextLivingPrepTotal)}원</b>
              </div>
              <i>=</i>
              <div className="result">
                <span>다음 월급에서 따로 둘 돈</span>
                <b>{fmt(summary.salaryReserveTotal)}원</b>
              </div>
            </div>
            <div className="payment-ready-carry">
              <span>이미 보관한 돈까지 포함한 전체 준비금</span>
              <b>{fmt(summary.closingPreparedTotal)}원</b>
            </div>
            <div className="payment-ready-note">생활 예산 한도는 실제 지출 전이라 포함하지 않아요.</div>
          </section>
          <p className="monthly-summary-note closing-help">아래에서 이번 달 수입·지출·정산과 결제수단별 금액을 맞춰볼 수 있어요.</p>
        </>
      ) : (
        <section className="payment-ready closing-overview" aria-label="월 마감 안내">
          <div className="payment-ready-eyebrow">{Number(vKey.slice(5, 7))}월 월 마감</div>
          <div className="closing-member-title">내가 결제한 가계 사용분</div>
          <div className="payment-ready-amount">{fmt(summary.spouseUsage)}원</div>
          <div className="payment-ready-note">대표 계정에서는 이 금액을 배우자 정산으로 확인해요. 아래 결제수단에서 내 카드사별 내역을 볼 수 있어요.</div>
        </section>
      )}
      <AnalysisScreen ledgerOnly />
    </div>
  )
}
