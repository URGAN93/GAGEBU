import { useAppStore } from '../store/useAppStore.js'

const NAV_ITEMS = [
  {
    col: 'calendar',
    label: '내가계부',
    icon: 'M7 2v2H5a2 2 0 0 0-2 2v2h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zM3 10v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10H3zm4 3h4v4H7v-4z',
  },
  {
    col: 'budget',
    label: '예산',
    icon: 'M3 6a2 2 0 0 1 2-2h13v2H5a.5.5 0 0 0 0 1h15a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6zm14 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  },
  {
    col: 'analysis',
    label: '분석',
    icon: 'M4 20V10h4v10H4zm6 0V4h4v16h-4zm6 0v-7h4v7h-4z',
  },
]

const SETTINGS_ICON =
  'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9.4 4a7.4 7.4 0 0 0-.14-1.4l2.1-1.65-2-3.46-2.48 1a7.6 7.6 0 0 0-2.42-1.4L16 2h-4l-.46 2.6a7.6 7.6 0 0 0-2.42 1.4l-2.48-1-2 3.46 2.1 1.64A7.4 7.4 0 0 0 6.6 12c0 .48.05.94.14 1.4l-2.1 1.65 2 3.46 2.48-1c.72.6 1.54 1.08 2.42 1.4L12 22h4l.46-2.6a7.6 7.6 0 0 0 2.42-1.4l2.48 1 2-3.46-2.1-1.64c.09-.46.14-.92.14-1.4z'

function Icon({ d }) {
  return (
    <svg className="bn-icon" viewBox="0 0 24 24">
      <path d={d} />
    </svg>
  )
}

export default function NavBar() {
  const activeCol = useAppStore((s) => s.activeCol)
  const setActiveCol = useAppStore((s) => s.setActiveCol)
  const openTxSheet = useAppStore((s) => s.openTxSheet)
  const openSettingsSheet = useAppStore((s) => s.openSettingsSheet)

  return (
    <>
      <nav className="side-rail">
        {NAV_ITEMS.map((item) => (
          <button key={item.col} className={`sr-item${activeCol === item.col ? ' active' : ''}`} onClick={() => setActiveCol(item.col)}>
            <Icon d={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
        <button className="sr-item" onClick={openSettingsSheet}>
          <Icon d={SETTINGS_ICON} />
          <span>설정</span>
        </button>
      </nav>

      {activeCol === 'calendar' && (
        <button className="fab" onClick={() => openTxSheet(null)}>
          + 내역 추가
        </button>
      )}

      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {NAV_ITEMS.map((item) => (
            <button key={item.col} className={`bn-item${activeCol === item.col ? ' active' : ''}`} onClick={() => setActiveCol(item.col)}>
              <Icon d={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
          <button className="bn-item" onClick={openSettingsSheet}>
            <Icon d={SETTINGS_ICON} />
            <span>설정</span>
          </button>
        </div>
      </nav>
    </>
  )
}
