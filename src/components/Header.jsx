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
          <path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.2 7.2 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.42l-.38 2.65c-.61.25-1.17.58-1.69.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65a.5.5 0 0 0 .5.42h4a.5.5 0 0 0 .5-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />
        </svg>
      </button>
    </header>
  )
}
