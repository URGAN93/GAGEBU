const btnStyle = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: '1px solid var(--line)',
  background: 'transparent',
  color: 'var(--ink)',
  cursor: 'pointer',
}

export default function Pager({ page, totalPages, onPrev, onNext, style }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, ...style }}>
      <button style={btnStyle} disabled={page <= 0} onClick={onPrev}>
        ‹
      </button>
      <span style={{ fontSize: 12, color: 'var(--ink-soft)', opacity: 0.7 }}>
        {page + 1}/{totalPages}
      </span>
      <button style={btnStyle} disabled={page >= totalPages - 1} onClick={onNext}>
        ›
      </button>
    </div>
  )
}
