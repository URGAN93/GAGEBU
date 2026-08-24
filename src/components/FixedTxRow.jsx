import { fmt, fixedInstallmentIndex } from '../lib/calc.js'

// 분석 탭 내역 리스트에 끼워넣는 고정지출 한 줄 (탭해도 아무 동작 없음 — 원본과 동일)
export default function FixedTxRow({ f, vKey }) {
  const idx = fixedInstallmentIndex(f, vKey)
  return (
    <div className="tx-item" style={{ cursor: 'default' }}>
      <div className="tx-left">
        <span className="tx-merchant" style={{ color: 'var(--gold)', fontWeight: 700 }}>
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
      <span className="tx-amt" style={{ color: 'var(--gold)', fontWeight: 700 }}>
        -{fmt(f.amount)}원
      </span>
    </div>
  )
}
