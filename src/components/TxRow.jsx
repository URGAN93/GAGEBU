import { fmt } from '../lib/calc.js'
import { findEnvelopeName } from '../lib/selectors.js'

// 거래 한 줄 표시 — 캘린더 하단 리스트, 분석 탭 리스트에서 공유해서 쓴다.
// onClick은 Phase 6(거래 추가/수정 모달)에서 실제로 연결된다 — 지금은 선택적.
export default function TxRow({ tx, categories, onClick }) {
  const { incomeCategories, livingCategories, irregularEnvelopes } = categories
  const d = new Date(tx.date)
  const instMonthAttr = tx.installmentIndex && tx.installmentIndex > 1 ? tx.date.slice(0, 7) : null
  const handleClick = onClick ? () => onClick(tx.id, instMonthAttr) : undefined

  if (tx.type === 'transfer') {
    const fromEnv = irregularEnvelopes.find((e) => e.id === tx.fromId)
    const toCat = livingCategories.find((c) => c.id === tx.toId)
    return (
      <div className="tx-item" onClick={handleClick}>
        <div className="tx-left">
          <span className="tx-merchant">
            ↔ {fromEnv ? fromEnv.name : '(삭제됨)'} → {toCat ? toCat.name : '(삭제됨)'}
          </span>
          <span className="tx-meta">
            {d.getMonth() + 1}.{d.getDate()} · 이체
          </span>
        </div>
        <span className="tx-amt">{fmt(tx.amount)}원</span>
      </div>
    )
  }

  if (tx.type === 'income') {
    const incomeCatName = findEnvelopeName('income', tx.categoryId, { incomeCategories, livingCategories, irregularEnvelopes })
    const incomeSub = tx.subcat ? ` · ${tx.subcat}` : ''
    return (
      <div className="tx-item" onClick={handleClick}>
        <div className="tx-left">
          <span className="tx-merchant">{tx.merchant || '(내용 없음)'}</span>
          <span className="tx-meta">
            {d.getMonth() + 1}.{d.getDate()} · {incomeCatName}
            {incomeSub}
          </span>
        </div>
        <span className="tx-amt" style={{ color: 'var(--ok)' }}>
          +{fmt(tx.amount)}원
        </span>
      </div>
    )
  }

  if (tx.type === 'settlement') {
    const linkedName = findEnvelopeName('settlement', tx.categoryId, { incomeCategories, livingCategories, irregularEnvelopes })
    const settleSub = tx.subcat ? ` · ${tx.subcat}` : ''
    return (
      <div className="tx-item" onClick={handleClick}>
        <div className="tx-left">
          <span className="tx-merchant">{tx.merchant || '(내용 없음)'}</span>
          <span className="tx-meta">
            {d.getMonth() + 1}.{d.getDate()} · 정산 · {linkedName}
            {settleSub}
          </span>
        </div>
        <span className="tx-amt" style={{ color: 'var(--gold)' }}>
          +{fmt(tx.amount)}원 정산
        </span>
      </div>
    )
  }

  const subLabel = tx.subcat ? ` · ${tx.subcat}` : ''
  const payLabel = tx.payMethod ? ` · ${tx.payMethod}` : ''
  const envName = findEnvelopeName(tx.type, tx.categoryId, { incomeCategories, livingCategories, irregularEnvelopes })
  const isInstallment = !!tx.installmentIndex

  return (
    <div className="tx-item" onClick={handleClick}>
      <div className="tx-left">
        <span className="tx-merchant" style={isInstallment ? { fontWeight: 700 } : undefined}>
          {tx.merchant || '(내용 없음)'}
          {isInstallment && (
            <span
              style={{
                display: 'inline-block',
                marginLeft: 6,
                padding: '1px 6px',
                borderRadius: 10,
                background: 'rgba(19,42,51,0.08)',
                color: 'var(--ink-soft)',
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 10.5,
                fontWeight: 700,
              }}
            >
              {tx.installmentIndex}/{tx.installmentCount}
            </span>
          )}
        </span>
        <span className="tx-meta">
          {d.getMonth() + 1}.{d.getDate()} · {envName}
          {subLabel}
          {payLabel}
        </span>
      </div>
      <span className="tx-amt">-{fmt(tx.amount)}원</span>
    </div>
  )
}
