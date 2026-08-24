import { useCallback, useEffect, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { expandMonthTx, fmtMan, monthKey, todayKST } from '../lib/calc.js'
import { useSwipeMonth } from '../hooks/useSwipeMonth.js'
import TxRow from '../components/TxRow.jsx'

const DOW = ['월', '화', '수', '목', '금', '토', '일']

export default function CalendarScreen() {
  const viewDate = useAppStore((s) => s.viewDate)
  const shiftMonth = useAppStore((s) => s.shiftMonth)
  const transactions = useAppStore((s) => s.transactions)
  const incomeCategories = useAppStore((s) => s.incomeCategories)
  const livingCategories = useAppStore((s) => s.livingCategories)
  const irregularEnvelopes = useAppStore((s) => s.irregularEnvelopes)
  const selectedCalDate = useAppStore((s) => s.selectedCalDate)
  const setSelectedCalDate = useAppStore((s) => s.setSelectedCalDate)
  const openTxSheet = useAppStore((s) => s.openTxSheet)

  const viewKey = monthKey(viewDate)
  const monthTx = useMemo(() => expandMonthTx(transactions, viewKey), [transactions, viewKey])

  // 달이 바뀌면: 실제 오늘이 속한 달이면 오늘을 자동 선택, 아니면 선택 해제.
  // (예전 vanilla 버전에서 이걸 깜빡해서 하단 리스트가 이전 달 내역인 채로 남아있던 버그가 있었다 —
  // 여기서는 달이 바뀔 때마다 이 effect가 항상 다시 계산해주므로 그 버그 자체가 생길 수 없다.)
  useEffect(() => {
    const todayStr = todayKST()
    setSelectedCalDate(todayStr.slice(0, 7) === viewKey ? todayStr : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey])

  const handleSwipe = useCallback((dir) => shiftMonth(dir), [shiftMonth])
  const { areaRef, dragRef } = useSwipeMonth(handleSwipe)

  const y = viewDate.getFullYear()
  const m = viewDate.getMonth()
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const todayStr = todayKST()

  const dayTotals = useMemo(() => {
    const totals = {}
    monthTx
      .filter((t) => t.type === 'living' || t.type === 'irregular')
      .forEach((t) => {
        totals[t.date] = (totals[t.date] || 0) + t.amount
      })
    return totals
  }, [monthTx])

  const days = []
  for (let i = 0; i < firstDow; i++) days.push(null)
  for (let day = 1; day <= daysInMonth; day++) days.push(day)

  const dayTx = useMemo(() => (selectedCalDate ? monthTx.filter((t) => t.date === selectedCalDate) : []), [monthTx, selectedCalDate])

  const categories = { incomeCategories, livingCategories, irregularEnvelopes }

  return (
    <div className="col-calendar" id="colCalendar" ref={areaRef}>
      <div className="calendar-wrap">
        <div className="cal-grid" ref={dragRef}>
          {DOW.map((d) => (
            <div className="cal-dow" key={d}>
              {d}
            </div>
          ))}
          {days.map((day, i) => {
            if (day === null) return <div className="cal-day empty" key={`empty-${i}`} />
            const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const amt = dayTotals[dateStr]
            const isToday = dateStr === todayStr
            const isSelected = !isToday && dateStr === selectedCalDate
            return (
              <div
                key={dateStr}
                className={`cal-day ${amt ? 'has-spend' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedCalDate(dateStr)}
              >
                <span className="d-num">{day}</span>
                {amt ? <span className="d-amt">{fmtMan(amt)}</span> : null}
              </div>
            )
          })}
        </div>
        {selectedCalDate && (
          <div className="tx-list" style={{ marginTop: 12 }}>
            {dayTx.length === 0 ? (
              <div className="tx-empty">{selectedCalDate.slice(5).replace('-', '.')}에는 지출이 없어요.</div>
            ) : (
              dayTx.map((t) => <TxRow key={t.id + (t.installmentIndex || '')} tx={t} categories={categories} onClick={openTxSheet} />)
            )}
          </div>
        )}
      </div>
    </div>
  )
}
