import { useAppStore } from '../store/useAppStore.js'

const NAV_ITEMS = [
  {
    col: 'calendar',
    label: '데이터',
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
  {
    col: 'asset',
    label: '자산',
    icon: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-1.09a3.5 3.5 0 0 1-2.45-2.16l1.79-.73A1.6 1.6 0 0 0 11.9 14c.83 0 1.35-.36 1.35-.94 0-.6-.5-.86-1.7-1.19-1.6-.43-2.9-1-2.9-2.72 0-1.28.95-2.22 2.35-2.5V5.5h2v1.14a3.2 3.2 0 0 1 2.15 1.86l-1.72.79a1.44 1.44 0 0 0-1.4-.97c-.72 0-1.15.34-1.15.85 0 .55.53.79 1.75 1.12 1.68.46 2.87 1.09 2.87 2.79 0 1.36-1 2.28-2.4 2.56z',
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
