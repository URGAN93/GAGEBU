import { useAppStore } from '../store/useAppStore.js'
import { fmt } from '../lib/calc.js'
import { importedPaymentLabel, matchImportedCard } from '../lib/cardImports.js'

function displayDateTime(occurredAt) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(occurredAt))
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`
}

export default function CardImportInbox() {
  const payments = useAppStore((s) => s.pendingCardPayments)
  const open = useAppStore((s) => s.cardInboxOpen)
  const payMethods = useAppStore((s) => s.payMethods)
  const openCardInbox = useAppStore((s) => s.openCardInbox)
  const closeCardInbox = useAppStore((s) => s.closeCardInbox)
  const reviewCardPayment = useAppStore((s) => s.reviewCardPayment)
  const ignoreCardPayment = useAppStore((s) => s.ignoreCardPayment)

  if (payments.length === 0) return null

  const first = payments[0]

  return (
    <>
      <button className="card-import-banner" onClick={openCardInbox}>
        <span className="card-import-icon" aria-hidden="true">⌁</span>
        <span className="card-import-banner-copy">
          <strong>확인할 카드 결제 {payments.length}건</strong>
          <small>{first.cardName} · {fmt(first.amount)}원 · {displayDateTime(first.occurredAt)}</small>
        </span>
        <span className="card-import-chevron" aria-hidden="true">›</span>
      </button>

      <div className={`sheet-backdrop${open ? ' show' : ''}`} onClick={closeCardInbox} />
      <section className={`sheet card-import-sheet${open ? ' show' : ''}`} aria-label="미분류 카드 결제">
        <div className="sheet-handle" />
        <div className="card-import-heading">
          <div>
            <span>자동으로 가져온 내역</span>
            <h3>미분류 카드 결제</h3>
          </div>
          <strong>{payments.length}</strong>
        </div>
        <p className="card-import-help">금액과 결제 정보를 확인한 뒤 카테고리만 지정하면 돼요.</p>

        <div className="card-import-list">
          {payments.map((payment) => {
            const matchedPayMethod = matchImportedCard(payment.cardName, payMethods)
            return (
              <article className="card-import-item" key={payment.id}>
                <div className="card-import-item-top">
                  <div>
                    <span className="card-import-status">{payment.status === 'cancelled' ? '승인 취소' : '승인'}</span>
                    <strong>{fmt(payment.amount)}원</strong>
                  </div>
                  <time>{displayDateTime(payment.occurredAt)}</time>
                </div>
                <div className="card-import-meta">
                  <span>{payment.cardName}</span>
                  <span>{importedPaymentLabel(payment)}</span>
                </div>
                <div className={`card-import-match${matchedPayMethod ? ' matched' : ''}`}>
                  {matchedPayMethod ? `${matchedPayMethod}에 자동 연결` : '등록할 때 결제수단을 선택해주세요'}
                </div>
                <div className="card-import-actions">
                  <button className="card-import-ignore" onClick={() => ignoreCardPayment(payment.id)}>제외</button>
                  <button className="card-import-review" onClick={() => reviewCardPayment(payment.id)}>등록하기</button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </>
  )
}
