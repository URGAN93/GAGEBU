import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import {
  expandMonthTx,
  monthKey,
  fmt,
  activeFixedExpenses,
  sortTx,
  getBudgetForCategory,
  settlementsForCategory,
  settlementsForCategoryRange,
  creditedForEnvelope,
  monthlyAmountForMonth,
  irregularContributions,
} from '../lib/calc.js'
import { statusColor } from '../lib/theme.js'
import TxRow from '../components/TxRow.jsx'
import FixedTxRow from '../components/FixedTxRow.jsx'
import Pager from '../components/Pager.jsx'

const PAGE_SIZE = 10
const VIEW_TABS = [
  { key: 'expense', label: '지출' },
  { key: 'income', label: '수입' },
  { key: 'settlement', label: '정산' },
  { key: 'all', label: '합계' },
  { key: 'pay', label: '결제수단' },
]

export default function AnalysisScreen() {
  const activeCol = useAppStore((s) => s.activeCol)
  const viewDate = useAppStore((s) => s.viewDate)
  const transactions = useAppStore((s) => s.transactions)
  const fixedExpenses = useAppStore((s) => s.fixedExpenses)
  const livingCategories = useAppStore((s) => s.livingCategories)
  const irregularEnvelopes = useAppStore((s) => s.irregularEnvelopes)
  const incomeCategories = useAppStore((s) => s.incomeCategories)
  const monthlyBudgets = useAppStore((s) => s.monthlyBudgets)
  const envelopeRateChanges = useAppStore((s) => s.envelopeRateChanges)
  const envelopeBonusCredits = useAppStore((s) => s.envelopeBonusCredits)
  const openTxSheet = useAppStore((s) => s.openTxSheet)

  const categories = { incomeCategories, livingCategories, irregularEnvelopes }
  const vKey = monthKey(viewDate)
  const monthTx = useMemo(() => expandMonthTx(transactions, vKey), [transactions, vKey])
  const activeFixed = useMemo(() => activeFixedExpenses(fixedExpenses, vKey), [fixedExpenses, vKey])

  const [revealed, setRevealed] = useState(false)
  const [currentView, setCurrentView] = useState('all')
  const [currentSort, setCurrentSort] = useState('date_desc')
  const [currentCatFilter, setCurrentCatFilter] = useState('')
  const [txPage, setTxPage] = useState(0)
  const [payPage, setPayPage] = useState(0)
  const [selectedPayFilter, setSelectedPayFilter] = useState(null)
  const [fixedSectionCollapsed, setFixedSectionCollapsed] = useState(true)

  // 분석 탭을 벗어나면 항상 다시 블러 처리 (원본 setActiveCol의 동작과 동일)
  useEffect(() => {
    if (activeCol !== 'analysis') setRevealed(false)
  }, [activeCol])

  // 지출 탭이 아니면 카테고리 필터는 무의미하니 원본처럼 초기화
  useEffect(() => {
    if (currentView !== 'expense') setCurrentCatFilter('')
  }, [currentView])

  const fixedTotal = activeFixed.reduce((s, f) => s + f.amount, 0)
  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const settled = monthTx.filter((t) => t.type === 'settlement').reduce((s, t) => s + t.amount, 0)
  const rawExpense = monthTx.filter((t) => t.type === 'living' || t.type === 'irregular').reduce((s, t) => s + t.amount, 0) + fixedTotal
  const expense = rawExpense - settled

  // ── 지출/수입/정산/합계 리스트 ──
  let filteredTx =
    currentView === 'expense'
      ? monthTx.filter((t) => t.type === 'living' || t.type === 'irregular')
      : currentView === 'income'
        ? monthTx.filter((t) => t.type === 'income')
        : currentView === 'settlement'
          ? monthTx.filter((t) => t.type === 'settlement')
          : monthTx
  if (currentView === 'expense' && currentCatFilter) {
    filteredTx = filteredTx.filter((t) => t.categoryId === currentCatFilter)
  }
  const fixedRows = !currentCatFilter && (currentView === 'expense' || currentView === 'all') ? activeFixed : []
  const sorted = sortTx(filteredTx, currentSort)
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const clampedTxPage = Math.min(Math.max(txPage, 0), totalPages - 1)
  const showLabels = fixedRows.length > 0 && sorted.length > 0
  const pageStart = clampedTxPage * PAGE_SIZE
  const pageTx = sorted.slice(pageStart, pageStart + PAGE_SIZE)

  const emptyMsg =
    currentView === 'expense'
      ? '이번 달 지출 내역이 없어요.'
      : currentView === 'income'
        ? '이번 달 수입 내역이 없어요.'
        : currentView === 'settlement'
          ? '이번 달 정산 내역이 없어요.'
          : '이번 달 내역이 없어요.'

  // ── 결제수단별 요약/리스트 ──
  const payTotals = {}
  monthTx
    .filter((t) => t.type !== 'transfer' && t.payMethod)
    .forEach((t) => {
      payTotals[t.payMethod] = (payTotals[t.payMethod] || 0) + t.amount
    })
  activeFixed.forEach((f) => {
    if (f.payMethod) payTotals[f.payMethod] = (payTotals[f.payMethod] || 0) + f.amount
  })
  const payEntries = Object.entries(payTotals).sort((a, b) => b[1] - a[1])

  // 원본과 동일하게, 이번 달 활성화된 고정지출이 아니라 등록된 전체 고정지출에서 결제수단으로 필터한다
  // ── 카테고리 필터 선택 시 상단에 보여줄 지출/예산 요약 ──
  const filterCat = currentView === 'expense' && currentCatFilter ? livingCategories.find((c) => c.id === currentCatFilter) : null
  const filterEnv = currentView === 'expense' && currentCatFilter ? irregularEnvelopes.find((e) => e.id === currentCatFilter) : null

  let catSummary = null
  if (filterCat) {
    const catSpent = monthTx.filter((t) => t.type === 'living' && t.categoryId === filterCat.id).reduce((s, t) => s + t.amount, 0)
    const catSettled = settlementsForCategory(transactions, filterCat.id, vKey)
    const effectiveSpent = catSpent - catSettled
    const budget = getBudgetForCategory(monthlyBudgets, filterCat, vKey)
    const pct = budget ? (effectiveSpent / budget) * 100 : 0
    const remain = budget - effectiveSpent
    catSummary = { effectiveSpent, budget, pct, remain }
  } else if (filterEnv) {
    const credited = creditedForEnvelope(envelopeRateChanges, envelopeBonusCredits, filterEnv, filterEnv.startMonth, vKey)
    const contributions = irregularContributions(transactions, filterEnv.id, filterEnv.startMonth, vKey)
    const spentAll = contributions.reduce((s, r) => s + r.amount, 0)
    const settledAll = settlementsForCategoryRange(transactions, filterEnv.id, filterEnv.startMonth, vKey)
    const balance = credited - (spentAll - settledAll)
    const thisMonthRate = monthlyAmountForMonth(envelopeRateChanges, filterEnv, vKey)
    const spentThisMonth = contributions.filter((r) => r.month === vKey).reduce((s, r) => s + r.amount, 0)
    const settledThisMonth = settlementsForCategory(transactions, filterEnv.id, vKey)
    const effectiveSpentThisMonth = settledThisMonth > 0 ? spentThisMonth - settledThisMonth : spentThisMonth
    catSummary = { isEnvelope: true, effectiveSpentThisMonth, thisMonthRate, balance }
  }

  const fixedPayRows = selectedPayFilter ? fixedExpenses.filter((f) => f.payMethod === selectedPayFilter) : []
  const payFiltered = selectedPayFilter
    ? sortTx(
        monthTx.filter((t) => t.type !== 'transfer' && t.payMethod === selectedPayFilter),
        currentSort,
      )
    : []
  const payTotalPages = Math.max(1, Math.ceil(payFiltered.length / PAGE_SIZE))
  const clampedPayPage = Math.min(Math.max(payPage, 0), payTotalPages - 1)
  const payPageStart = clampedPayPage * PAGE_SIZE
  const payPageTx = payFiltered.slice(payPageStart, payPageStart + PAGE_SIZE)

  return (
    <div className="col-analysis">
      <div id="analysisBlurContainer" className={!revealed ? 'hidden-state' : ''} style={{ position: 'relative' }} onClick={() => setRevealed((v) => !v)}>
        <div id="analysisBlurWrap" className={!revealed ? 'blur-hidden' : ''}>
          <div className="passbook">
            <div className="eyebrow">이번 달 분석</div>
            <div className="total-row">
              <span className="total-amt">{fmt(income - expense)}</span>
              <span className="total-of">원 순합계 (수입 − 지출)</span>
            </div>
          </div>
          <div className="tx-list" style={{ margin: '14px 0' }}>
            <div className="tx-item">
              <span className="tx-merchant">총 수입</span>
              <span className="tx-amt">{fmt(income)}원</span>
            </div>
            <div className="tx-item">
              <span className="tx-merchant">총 지출</span>
              <span className="tx-amt">{fmt(expense)}원</span>
            </div>
            {settled > 0 && (
              <div className="tx-item">
                <span className="tx-merchant">정산받은 금액</span>
                <span className="tx-amt">+{fmt(settled)}원</span>
              </div>
            )}
          </div>
          {settled > 0 && (
            <div style={{ fontSize: 11, opacity: 0.6, margin: '-8px 0 0 4px' }}>
              실지출 {fmt(rawExpense)}원 − 정산 {fmt(settled)}원 = 실질 지출 {fmt(expense)}원
            </div>
          )}
        </div>
        {!revealed && <div id="analysisBlurHint">탭하면 금액이 보여요</div>}
      </div>

      <div className="recent">
        <div className="view-tabs">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`view-tab${currentView === tab.key ? ' active' : ''}`}
              onClick={() => setCurrentView(tab.key)}
            >
              {tab.label}
            </button>
          ))}
          <select
            style={{ marginLeft: 'auto', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 8px', fontSize: 12, background: '#fff', color: 'var(--ink-soft)' }}
            value={currentSort}
            onChange={(e) => {
              setCurrentSort(e.target.value)
              setTxPage(0)
              setPayPage(0)
            }}
          >
            <option value="date_desc">날짜 최신순</option>
            <option value="date_asc">날짜 오래된순</option>
            <option value="amount_desc">금액 높은순</option>
            <option value="amount_asc">금액 낮은순</option>
          </select>
        </div>

        {currentView === 'expense' && (
          <select
            style={{ display: 'block', width: '100%', marginBottom: 10, border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: 12, background: '#fff', color: 'var(--ink-soft)' }}
            value={currentCatFilter}
            onChange={(e) => {
              setCurrentCatFilter(e.target.value)
              setTxPage(0)
            }}
          >
            <option value="">전체 카테고리</option>
            <optgroup label="생활 카테고리">
              {livingCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="누적 카테고리">
              {irregularEnvelopes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          </select>
        )}

        {catSummary && !catSummary.isEnvelope && (
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
            <div className="env-numbers">
              <span className="env-spent">{fmt(catSummary.effectiveSpent)}원</span>
              <span className="env-limit"> / {fmt(catSummary.budget)}원</span>
            </div>
            <div className="env-bar">
              <div className="env-bar-fill" style={{ width: Math.min(100, Math.max(0, catSummary.pct)) + '%', background: statusColor(catSummary.pct) }} />
            </div>
            <div className="env-remain" style={{ marginTop: 4 }}>
              {catSummary.remain >= 0 ? (
                <>
                  이번 달 <b>{fmt(catSummary.remain)}원</b> 더 쓸 수 있어요
                </>
              ) : (
                <>
                  <b style={{ color: statusColor(catSummary.pct) }}>{fmt(Math.abs(catSummary.remain))}원</b> 초과했어요
                </>
              )}
            </div>
          </div>
        )}

        {catSummary && catSummary.isEnvelope && (
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
            <div className="env-numbers">
              <span className="env-spent">{fmt(catSummary.effectiveSpentThisMonth)}원</span>
              <span className="env-limit"> / 월 충전 {fmt(catSummary.thisMonthRate)}원</span>
            </div>
            <div className="irr-foot" style={{ marginTop: 4 }}>
              <span>누적 잔액 {fmt(catSummary.balance)}원</span>
            </div>
          </div>
        )}

        {currentView === 'pay' ? (
          <>
            {payEntries.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {payEntries.map(([name, amt]) => (
                  <div
                    key={name}
                    className={`pay-pill${selectedPayFilter === name ? ' active' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedPayFilter((cur) => (cur === name ? null : name))
                      setPayPage(0)
                    }}
                  >
                    <span className="pp-name">{name}</span>
                    <span className="pp-amt">{fmt(amt)}원</span>
                  </div>
                ))}
              </div>
            )}
            {selectedPayFilter && (
              <>
                <div className="tx-list" style={{ marginBottom: 10 }}>
                  {payFiltered.length === 0 && fixedPayRows.length === 0 ? (
                    <div className="tx-empty">이번 달 {selectedPayFilter} 지출 내역이 없어요.</div>
                  ) : (
                    <>
                      {fixedPayRows.map((f) => (
                        <FixedTxRow key={f.id} f={f} vKey={vKey} />
                      ))}
                      {payFiltered.length > 0 && payPageTx.map((t) => <TxRow key={t.id + (t.installmentIndex || '')} tx={t} categories={categories} onClick={openTxSheet} />)}
                    </>
                  )}
                </div>
                {payFiltered.length > 0 && (
                  <Pager page={clampedPayPage} totalPages={payTotalPages} onPrev={() => setPayPage((p) => p - 1)} onNext={() => setPayPage((p) => p + 1)} style={{ marginBottom: 12 }} />
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className="tx-list">
              {sorted.length === 0 && fixedRows.length === 0 ? (
                <div className="tx-empty">{emptyMsg}</div>
              ) : (
                <>
                  {fixedRows.length > 0 &&
                    (showLabels ? (
                      <>
                        <div
                          className={`section-label${fixedSectionCollapsed ? ' collapsed' : ''}`}
                          style={{ margin: 0, padding: '10px 16px 4px 16px', fontSize: 11, letterSpacing: 0.5 }}
                          onClick={() => setFixedSectionCollapsed((v) => !v)}
                        >
                          <span>고정지출</span>
                          <span className="chevron">▾</span>
                        </div>
                        <div className={`section-body${fixedSectionCollapsed ? ' collapsed' : ''}`}>
                          {fixedRows.map((f) => (
                            <FixedTxRow key={f.id} f={f} vKey={vKey} />
                          ))}
                        </div>
                      </>
                    ) : (
                      fixedRows.map((f) => <FixedTxRow key={f.id} f={f} vKey={vKey} />)
                    ))}
                  {sorted.length > 0 && (
                    <>
                      {showLabels && (
                        <div style={{ padding: '10px 16px 4px 16px', fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', opacity: 0.55, letterSpacing: 0.5 }}>이번 달 내역</div>
                      )}
                      {pageTx.map((t) => (
                        <TxRow key={t.id + (t.installmentIndex || '')} tx={t} categories={categories} onClick={openTxSheet} />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
            <Pager page={clampedTxPage} totalPages={totalPages} onPrev={() => setTxPage((p) => p - 1)} onNext={() => setTxPage((p) => p + 1)} style={{ marginTop: 10 }} />
          </>
        )}
      </div>
    </div>
  )
}
