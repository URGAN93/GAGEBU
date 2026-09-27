import { useAppStore } from '../store/useAppStore.js'

export default function Header() {
  const viewDate = useAppStore((s) => s.viewDate)
  const shiftMonth = useAppStore((s) => s.shiftMonth)
  const openSettingsSheet = useAppStore((s) => s.openSettingsSheet)

  return (
    <header>
      <div className="month-nav">
        <button aria-label="이전 달" onClick={() => shiftMonth(-1)}>
          ‹
        </button>
      </div>
      <div className="month-label">
        <small>{viewDate.getFullYear()}년</small>
        <span>{viewDate.getMonth() + 1}월</span>
      </div>
      <div className="month-nav">
        <button aria-label="다음 달" onClick={() => shiftMonth(1)}>
          ›
        </button>
      </div>
      <button className="header-settings" type="button" aria-label="설정 열기" onClick={openSettingsSheet}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9.4 4a7.4 7.4 0 0 0-.14-1.4l2.1-1.65-2-3.46-2.48 1a7.6 7.6 0 0 0-2.42-1.4L16 2h-4l-.46 2.6a7.6 7.6 0 0 0-2.42 1.4l-2.48-1-2 3.46 2.1 1.64A7.4 7.4 0 0 0 6.6 12c0 .48.05.94.14 1.4l-2.1 1.65 2 3.46 2.48-1c.72.6 1.54 1.08 2.42 1.4L12 22h4l.46-2.6a7.6 7.6 0 0 0 2.42-1.4l2.48 1 2-3.46-2.1-1.64c.09-.46.14-.92.14-1.4z" />
        </svg>
      </button>
    </header>
  )
}
