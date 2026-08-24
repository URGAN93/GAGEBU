import { useAppStore } from '../store/useAppStore.js'

export default function Header() {
  const viewDate = useAppStore((s) => s.viewDate)
  const shiftMonth = useAppStore((s) => s.shiftMonth)

  return (
    <header>
      <div className="month-label">
        <small>{viewDate.getFullYear()}년</small>
        <span>{viewDate.getMonth() + 1}월</span>
      </div>
      <div className="month-nav">
        <button aria-label="이전 달" onClick={() => shiftMonth(-1)}>
          ‹
        </button>
        <button aria-label="다음 달" onClick={() => shiftMonth(1)}>
          ›
        </button>
      </div>
    </header>
  )
}
