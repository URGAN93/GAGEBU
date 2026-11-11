import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { fmt, monthKey, addMonths } from '../lib/calc.js'
import PinPad from '../components/PinPad.jsx'
import AssetEntrySheet from '../components/AssetEntrySheet.jsx'

const ASSET_PIN = '0618'

export default function AssetScreen() {
  const assetCategories = useAppStore((s) => s.assetCategories)
  const assetEntries = useAppStore((s) => s.assetEntries)
  const deleteAssetEntry = useAppStore((s) => s.deleteAssetEntry)
  const showToast = useAppStore((s) => s.showToast)
  const activeCol = useAppStore((s) => s.activeCol)
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [entryCategoryId, setEntryCategoryId] = useState(null)

  // 이 탭은 항상 마운트된 채로 CSS로만 숨겨지므로, 다른 탭으로 나가는 순간 다시 잠가서
  // 다음에 자산 탭에 돌아왔을 때 매번 PIN을 다시 물어보게 한다.
  useEffect(() => {
    if (activeCol !== 'asset') {
      setUnlocked(false)
      setPinOpen(false)
    }
  }, [activeCol])

  const totalsByCategory = useMemo(() => {
    const map = {}
    assetEntries.forEach((e) => {
      map[e.categoryId] = (map[e.categoryId] || 0) + e.amount
    })
    return map
  }, [assetEntries])

  const totalAssets = useMemo(() => Object.values(totalsByCategory).reduce((s, v) => s + v, 0), [totalsByCategory])
  const selectedCategory = assetCategories.find((cat) => cat.id === selectedCategoryId) || null
  const selectedEntries = selectedCategory ? assetEntries
    .filter((entry) => entry.categoryId === selectedCategory.id)
    .slice()
    .sort((a, b) => (b.createdAt || b.month || '').localeCompare(a.createdAt || a.month || '')) : []

  const nowKey = monthKey(new Date())
  // 최근 6개월(이번 달 포함) 월별 순증감 = 그 달에 기록된 entries 합계
  const monthlyDelta = useMemo(() => {
    const keys = []
    for (let i = 5; i >= 0; i--) keys.push(addMonths(nowKey, -i))
    const map = Object.fromEntries(keys.map((k) => [k, 0]))
    assetEntries.forEach((e) => {
      if (map[e.month] !== undefined) map[e.month] += e.amount
    })
    return keys.map((k) => ({ month: k, amount: map[k] }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetEntries, nowKey])

  const avg6 = monthlyDelta.reduce((s, m) => s + m.amount, 0) / 6
  const thisMonthDelta = monthlyDelta[monthlyDelta.length - 1]?.amount || 0
  const maxAbs = Math.max(1, ...monthlyDelta.map((m) => Math.abs(m.amount)))

  return (
    <div className="col-asset">
      <div id="assetBlurContainer" className={!unlocked ? 'hidden-state' : ''} style={{ position: 'relative' }} onClick={!unlocked ? () => setPinOpen(true) : undefined}>
      <div id="assetBlurWrap" className={`asset-overview${!unlocked ? ' blur-hidden' : ''}`}>
        <div className="asset-total-eyebrow">총 자산</div>
        <div className="asset-total-amt">{fmt(totalAssets)}원</div>

        <div className="asset-cat-list">
          {assetCategories.map((cat) => {
            const amt = totalsByCategory[cat.id] || 0
            const pct = totalAssets > 0 ? Math.round((amt / totalAssets) * 100) : 0
            return (
              <div
                key={cat.id}
                className="asset-cat-row"
                onClick={() => setSelectedCategoryId(cat.id)}
              >
                <div className="asset-cat-top">
                  <div className="asset-cat-name">
                    <span className="env-icon" style={{ background: cat.color }} />
                    {cat.name}
                  </div>
                  <div className="asset-cat-pct">{pct}%</div>
                </div>
                <div className="asset-cat-amt">{fmt(amt)}원</div>
                <div className="asset-cat-bar">
                  <div className="asset-cat-bar-fill" style={{ width: pct + '%', background: cat.color }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="asset-trend">
          <div className="asset-trend-title">자산 변화 추이</div>
          <div className="asset-trend-stats">
            <div className="asset-trend-stat">
              최근 6개월 평균 변동
              <b style={{ color: avg6 >= 0 ? 'var(--ok)' : 'var(--over)' }}>
                {avg6 >= 0 ? '+' : ''}
                {fmt(avg6)}원
              </b>
            </div>
            <div className="asset-trend-stat">
              이번 달 변동
              <b style={{ color: thisMonthDelta >= 0 ? 'var(--ok)' : 'var(--over)' }}>
                {thisMonthDelta >= 0 ? '+' : ''}
                {fmt(thisMonthDelta)}원
              </b>
            </div>
          </div>
          <div className="asset-chart">
            {monthlyDelta.map((m) => {
              const pct = Math.max(2, (Math.abs(m.amount) / maxAbs) * 100)
              return (
                <div key={m.month} className="asset-chart-col">
                  <div className="asset-chart-half asset-chart-half-top">
                    {m.amount >= 0 && <div className="asset-chart-bar" style={{ height: pct + '%', background: 'var(--ok)' }} />}
                  </div>
                  <div className="asset-chart-half asset-chart-half-bottom">
                    {m.amount < 0 && <div className="asset-chart-bar" style={{ height: pct + '%', background: 'var(--over)' }} />}
                  </div>
                  <div className="asset-chart-label">{m.month.slice(5)}월</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {!unlocked && (
        <div id="assetBlurHint" onClick={() => setPinOpen(true)}>
          탭하면 PIN 입력
        </div>
      )}
      </div>
      {pinOpen && (
        <PinPad
          pin={ASSET_PIN}
          onClose={() => setPinOpen(false)}
          onSuccess={() => {
            setUnlocked(true)
            setPinOpen(false)
          }}
          onWrong={() => showToast('PIN 번호가 틀렸어요')}
        />
      )}
      {selectedCategory && (
        <div className="asset-detail-layer">
          <button className="asset-detail-backdrop" aria-label="닫기" onClick={() => setSelectedCategoryId(null)} />
          <section className="asset-detail-sheet" role="dialog" aria-modal="true" aria-label={`${selectedCategory.name} 내역`}>
            <div className="sheet-handle" />
            <header className="asset-detail-header">
              <button type="button" className="asset-detail-back" onClick={() => setSelectedCategoryId(null)}>‹ 자산</button>
              <span className="env-icon" style={{ background: selectedCategory.color }} />
              <div>
                <h2>{selectedCategory.name}</h2>
                <div className="asset-detail-total">{fmt(totalsByCategory[selectedCategory.id] || 0)}원</div>
              </div>
            </header>
            <div className="asset-detail-list">
              <div className="asset-detail-section-title">전체 내역 <span>{selectedEntries.length}건</span></div>
              {selectedEntries.length ? selectedEntries.map((entry) => (
                <div key={entry.id} className="asset-detail-entry">
                  <div className="asset-detail-entry-copy">
                    <time>{entry.createdAt ? entry.createdAt.slice(0, 10) : entry.month}</time>
                    <span>{entry.note || '입금(조정)'}</span>
                  </div>
                  <strong className={entry.amount < 0 ? 'negative' : ''}>{entry.amount > 0 ? '+' : ''}{fmt(entry.amount)}원</strong>
                  <button type="button" className="asset-entry-del" aria-label="내역 삭제" onClick={() => deleteAssetEntry(entry.id)}>✕</button>
                </div>
              )) : <div className="asset-detail-empty">아직 기록이 없어요.<br />아래 버튼으로 첫 내역을 추가해 주세요.</div>}
            </div>
            <button type="button" className="asset-detail-add" onClick={() => setEntryCategoryId(selectedCategory.id)}>＋ 내용 추가</button>
          </section>
        </div>
      )}
      <AssetEntrySheet categoryId={entryCategoryId} onClose={() => setEntryCategoryId(null)} />
    </div>
  )
}
