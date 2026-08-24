import { useState } from 'react'

// 원본의 .section-label[data-toggle] + .section-body 패턴을 그대로 옮긴 접기/펼치기 섹션.
export default function SectionToggle({ title, defaultCollapsed = false, children }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  return (
    <>
      <div className={`section-label${collapsed ? ' collapsed' : ''}`} onClick={() => setCollapsed((c) => !c)}>
        <span>{title}</span>
        <span className="chevron">▾</span>
      </div>
      <div className={`section-body${collapsed ? ' collapsed' : ''}`}>{children}</div>
    </>
  )
}
