import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { fmt, monthKey, addMonths } from '../lib/calc.js'

const ASSET_PIN = '0618'

export default function AssetScreen() {
  const assetCategories = useAppStore((s) => s.assetCategories)
  const assetEntries = useAppStore((s) => s.assetEntries)
  const addAssetEntry = useAppStore((s) => s.addAssetEntry)
  const deleteAssetEntry = useAppStore((s) => s.deleteAssetEntry)
  const showToast = useAppStore((s) => s.showToast)
  const [expandedId, setExpandedId] = useState(null)
  const [unlocked, setUnlocked] = useState(false)

  const handleUnlock = () => {
    const input = prompt('PIN 번호를 입력해주세요')
    if (input === null) return
    if (input === ASSET_PIN) {
      setUnlocked(true)
    } else {
      showToast('PIN 번호가 틀렸어요')
    }
  }

  const totalsByCategory = useMemo(() => {
    const map = {}
    assetEntries.forEach((e) => {
      map[e.categoryId] = (map[e.categoryId] || 0) + e.amount
    })
    return map
  }, [assetEntries])

  const totalAssets = useMemo(() => Object.values(totalsByCategory).reduce((s, v) => s + v, 0), [totalsByCategory])

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

  const handleAddEntry = async (categoryId) => {
    const input = prompt('입금(또는 조정) 금액을 입력해주세요 — 빼야 하면 마이너스로 입력')
    if (input === null) return
    const amount = parseInt(input.replace(/[^0-9-]/g, ''), 10)
    if (!amount) return
    const note = prompt('메모 (선택, 없으면 빈칸으로 확인)', '') || ''
    await addAssetEntry(categoryId, amount, nowKey, note)
  }

  return (
    <div className="col-asset">
      <div id="assetBlurContainer" className={!unlocked ? 'hidden-state' : ''} style={{ position: 'relative' }} onClick={!unlocked ? handleUnlock : undefined}>
      <div id="assetBlurWrap" className={`asset-overview${!unlocked ? ' blur-hidden' : ''}`}>
        <div className="asset-total-eyebrow">총 자산</div>
        <div className="asset-total-amt">{fmt(totalAssets)}원</div>

        <div className="asset-cat-list">
          {assetCategories.map((cat) => {
            const amt = totalsByCategory[cat.id] || 0
            const pct = totalAssets > 0 ? Math.round((amt / totalAssets) * 100) : 0
            const entries = assetEntries.filter((e) => e.categoryId === cat.id)
            const expanded = expandedId === cat.id
            return (
              <div
                key={cat.id}
                className={`asset-cat-row${expanded ? ' expanded' : ''}`}
                onClick={() => setExpandedId(expanded ? null : cat.id)}
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
                <div className="asset-cat-body">
                  {entries.length ? (
                    entries.map((e) => (
                      <div key={e.id} className="asset-entry-row">
                        <span>{e.month}</span>
                        <span>
                          {fmt(e.amount)}원{e.note ? ` · ${e.note}` : ''}
                        </span>
                        <button
                          type="button"
                          className="asset-entry-del"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            deleteAssetEntry(e.id)
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="asset-entry-empty">아직 기록이 없어요</div>
                  )}
                  <button
                    type="button"
                    className="asset-add-btn"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      handleAddEntry(cat.id)
                    }}
                  >
                    + 입금 추가
                  </button>
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
        <div id="assetBlurHint" onClick={handleUnlock}>
          탭하면 PIN 입력
        </div>
      )}
      </div>
    </div>
  )
}
