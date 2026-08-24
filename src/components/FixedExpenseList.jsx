import { fmt, fixedInstallmentIndex } from '../lib/calc.js'

export default function FixedExpenseList({ items, vKey }) {
  if (!items.length) {
    return <div className="tx-empty">등록된 고정지출이 없어요.</div>
  }
  const total = items.reduce((s, f) => s + f.amount, 0)
  return (
    <>
      <div className="tx-list">
        {items.map((f) => {
          const idx = fixedInstallmentIndex(f, vKey)
          return (
            <div className="tx-item" key={f.id}>
              <div className="tx-left">
                <span className="tx-merchant" style={idx ? { color: 'var(--gold)', fontWeight: 700 } : undefined}>
                  {f.name}
                  {idx ? (
                    <span
                      style={{
                        display: 'inline-block',
                        marginLeft: 6,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: 'rgba(185,138,46,0.15)',
                        color: 'var(--gold)',
                        fontFamily: "'IBM Plex Mono',monospace",
                        fontSize: 10.5,
                        fontWeight: 700,
                      }}
                    >
                      {idx}/{f.installmentCount}
                    </span>
                  ) : null}
                </span>
                <span className="tx-meta">고정지출{f.payMethod ? ` · ${f.payMethod}` : ''}</span>
              </div>
              <span className="tx-amt">{fmt(f.amount)}원</span>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 4px 0 4px', fontSize: 12.5, color: 'var(--ink-soft)', opacity: 0.7 }}>
        <span>총 {items.length}건</span>
        <span style={{ fontWeight: 700, opacity: 1 }}>합계 {fmt(total)}원</span>
      </div>
    </>
  )
}
