import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import {
  expandMonthTx,
  addMonths,
  monthKey,
  fmt,
  activeFixedExpenses,
  fixedAmountForMonth,
  sortTx,
  budgetAmountForMonth,
  settlementsForCategory,
  settlementsForCategoryRange,
  creditedForEnvelope,
  monthlyAmountForMonth,
  irregularContributions,
  monthlyIncomeSummary,
} from '../lib/calc.js'
import { statusColor } from '../lib/theme.js'
import TxRow from '../components/TxRow.jsx'
import FixedTxRow from '../components/FixedTxRow.jsx'
import Pager from '../components/Pager.jsx'
import { useEnvelopeFixedExpenses } from '../hooks/useEnvelopeFixedExpenses.js'

const PAGE_SIZE = 10
const SUBCATEGORY_COLORS = ['#3E7A55', '#B98A2E', '#3E6B9E', '#B04338', '#7562A8', '#A86642', '#4D8B8B', '#7B765E']
const VIEW_TABS = [
  { key: 'expense', label: '지출' },
  { key: 'income', label: '수입' },
  { key: 'settlement', label: '정산' },
  { key: 'all', label: '합계' },
  { key: 'pay', label: '결제수단' },
]

export default function AnalysisScreen({ ledgerOnly = false }) {
  const activeCol = useAppStore((s) => s.activeCol)
  const viewDate = useAppStore((s) => s.viewDate)
  const transactions = useAppStore((s) => s.transactions)
  const fixedExpenses = useAppStore((s) => s.fixedExpenses)
  const fixedRateChanges = useAppStore((s) => s.fixedRateChanges)
  const livingCategories = useAppStore((s) => s.livingCategories)
  const irregularEnvelopes = useAppStore((s) => s.irregularEnvelopes)
  const incomeCategories = useAppStore((s) => s.incomeCategories)
  const livingBudgetChanges = useAppStore((s) => s.livingBudgetChanges)
  const envelopeRateChanges = useAppStore((s) => s.envelopeRateChanges)
  const envelopeBonusCredits = useAppStore((s) => s.envelopeBonusCredits)
  const openTxSheet = useAppStore((s) => s.openTxSheet)
  const myUserId = useAppStore((s) => s.myUserId)
  const householdMembers = useAppStore((s) => s.householdMembers)
  const payMethods = useAppStore((s) => s.payMethods)

  const categories = { incomeCategories, livingCategories, irregularEnvelopes }
  const vKey = monthKey(viewDate)
  const displayMonth = Number(vKey.slice(5, 7))
  const envelopeFixed = useEnvelopeFixedExpenses(vKey)
  const allocationsError = useAppStore((s) => s.allocationsError)
  const monthTx = useMemo(() => expandMonthTx(transactions, vKey), [transactions, vKey])
  const activeFixed = useMemo(() => activeFixedExpenses(fixedExpenses, vKey), [fixedExpenses, vKey])

  const [revealed, setRevealed] = useState(false)
  const [currentView, setCurrentView] = useState('all')
  const [currentSort, setCurrentSort] = useState('date_desc')
  const [currentCatFilter, setCurrentCatFilter] = useState('')
  const [txPage, setTxPage] = useState(0)
  const [payPage, setPayPage] = useState(0)
  const [selectedPayFilter, setSelectedPayFilter] = useState(null)
  const [payOwnerFilter, setPayOwnerFilter] = useState('all')
  const [fixedSectionCollapsed, setFixedSectionCollapsed] = useState(true)
  const [trendSelection, setTrendSelection] = useState(null)
  const [trendDetailKey, setTrendDetailKey] = useState('')
  const [otherLabel, setOtherLabel] = useState(() => {
    try {
      return localStorage.getItem('payOwnerOtherLabel') || '배우자'
    } catch {
      return '배우자'
    }
  })
  const otherLongPressTimer = useRef(null)
  const otherLongPressFired = useRef(false)

  // "배우자" 버튼은 짧게 누르면 필터 전환, 꾹 누르고 있으면 표시 이름을 바꿀 수 있게 한다
  // (탭할 때마다 필터가 바뀌어야 하니 단순 클릭과 겹치지 않게 꾹 누르기로만 이름 수정을 연다).
  function handleOtherPressStart() {
    otherLongPressFired.current = false
    otherLongPressTimer.current = setTimeout(() => {
      otherLongPressFired.current = true
      const input = prompt('상대방 표시 이름을 입력해주세요', otherLabel)
      if (input && input.trim()) {
        const val = input.trim()
        setOtherLabel(val)
        try {
          localStorage.setItem('payOwnerOtherLabel', val)
        } catch {
          // localStorage 사용 불가 환경이면 이번 세션에서만 적용
        }
      }
    }, 550)
  }
  function handleOtherPressEnd() {
    clearTimeout(otherLongPressTimer.current)
  }
  function handleOtherClick() {
    if (otherLongPressFired.current) {
      otherLongPressFired.current = false
      return
    }
    setPayOwnerFilter('other')
    setSelectedPayFilter(null)
    setPayPage(0)
  }

  // 분석 탭을 벗어나면 항상 다시 블러 처리 (원본 setActiveCol의 동작과 동일)
  useEffect(() => {
    if (activeCol !== 'analysis') setRevealed(false)
  }, [activeCol])

  // 가계부 구성원이 1명뿐이면 나/배우자 구분이 무의미하니 전체로 되돌린다
  useEffect(() => {
    if (householdMembers.length <= 1) setPayOwnerFilter('all')
  }, [householdMembers.length])

  // 지출 탭이 아니면 카테고리 필터는 무의미하니 원본처럼 초기화
  useEffect(() => {
    if (currentView !== 'expense') setCurrentCatFilter('')
  }, [currentView])

  const fixedTotal = activeFixed.reduce((s, f) => s + fixedAmountForMonth(fixedRateChanges, f, vKey), 0) + envelopeFixed.reduce((s, f) => s + f.amount, 0)
  const envelopeIds = new Set(irregularEnvelopes.map((e) => e.id))
  const { householdIncome: income } = monthlyIncomeSummary({ monthTx, irregularEnvelopes, envelopeBonusCredits }, vKey)
  const settled = monthTx.filter((t) => t.type === 'settlement' && !envelopeIds.has(t.categoryId)).reduce((s, t) => s + t.amount, 0)
  const rawExpense = monthTx.filter((t) => t.type === 'living').reduce((s, t) => s + t.amount, 0) + fixedTotal
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
  } else if (currentView === 'expense' || currentView === 'all' || currentView === 'settlement') {
    filteredTx = filteredTx.filter((t) => t.type !== 'irregular' && !(t.type === 'settlement' && envelopeIds.has(t.categoryId)))
  }
  const fixedRows = !currentCatFilter && (currentView === 'expense' || currentView === 'all') ? [...activeFixed, ...envelopeFixed] : []
  const sorted = sortTx(filteredTx, currentSort)
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const clampedTxPage = Math.min(Math.max(txPage, 0), totalPages - 1)
  const showLabels = fixedRows.length > 0 && sorted.length > 0
  const pageStart = clampedTxPage * PAGE_SIZE
  const pageTx = sorted.slice(pageStart, pageStart + PAGE_SIZE)

  const emptyMsg =
    currentView === 'expense'
      ? `${displayMonth}월 지출 내역이 없어요.`
      : currentView === 'income'
        ? `${displayMonth}월 수입 내역이 없어요.`
        : currentView === 'settlement'
          ? `${displayMonth}월 정산 내역이 없어요.`
          : `${displayMonth}월 내역이 없어요.`

  // ── 결제수단별 요약/리스트 ──
  // 가계부 구성원이 2명 이상이면 "전체/나/배우자"로 나눠 볼 수 있다. 거래(transactions)는
  // user_id로 누가 입력했는지 알 수 있지만, 고정지출은 개인 소유가 아니라 household 공유라서
  // DB상으로는 누구 것인지 구분할 수 없다. 대신 결제수단(pay_methods)은 개인 소유라 내 계정엔
  // 내 결제수단만 보이므로, 고정지출의 결제수단 이름이 "내" 결제수단 목록에 있으면 내 것으로,
  // 없으면(=배우자 결제수단일 가능성이 높음) 배우자 것으로 추정해서 배분한다.
  const hasMultipleMembers = householdMembers.length > 1
  const isMyPayMethod = (name) => payMethods.some((p) => p.name === name)
  const payTxFilter =
    payOwnerFilter === 'mine' ? (t) => t.userId === myUserId : payOwnerFilter === 'other' ? (t) => t.userId !== myUserId : () => true
  const fixedPayFilter =
    payOwnerFilter === 'mine' ? (f) => isMyPayMethod(f.payMethod) : payOwnerFilter === 'other' ? (f) => !isMyPayMethod(f.payMethod) : () => true
  const payTotals = {}
  monthTx
    .filter((t) => t.type !== 'transfer' && t.payMethod)
    .filter(payTxFilter)
    .forEach((t) => {
      payTotals[t.payMethod] = (payTotals[t.payMethod] || 0) + t.amount
    })
  activeFixed.filter(fixedPayFilter).forEach((f) => {
    if (f.payMethod) payTotals[f.payMethod] = (payTotals[f.payMethod] || 0) + fixedAmountForMonth(fixedRateChanges, f, vKey)
  })
  const payEntries = Object.entries(payTotals).sort((a, b) => b[1] - a[1])
  const payGrandTotal = payEntries.reduce((s, [, amt]) => s + amt, 0)
  // 원본과 동일하게, 이번 달 활성화된 고정지출이 아니라 등록된 전체 고정지출에서 결제수단으로 필터한다
  // ── 카테고리 필터 선택 시 상단에 보여줄 지출/예산 요약 ──
  const filterCat = currentView === 'expense' && currentCatFilter ? livingCategories.find((c) => c.id === currentCatFilter) : null
  const filterEnv = currentView === 'expense' && currentCatFilter ? irregularEnvelopes.find((e) => e.id === currentCatFilter) : null

  let catSummary = null
  if (filterCat) {
    const catSpent = monthTx.filter((t) => t.type === 'living' && t.categoryId === filterCat.id).reduce((s, t) => s + t.amount, 0)
    const catSettled = settlementsForCategory(transactions, filterCat.id, vKey)
    const effectiveSpent = catSpent - catSettled
    const budget = budgetAmountForMonth(livingBudgetChanges, filterCat, vKey)
    const pct = budget ? (effectiveSpent / budget) * 100 : 0
    const remain = budget - effectiveSpent
    catSummary = { effectiveSpent, budget, pct, remain, budgetEnabled: filterCat.budgetEnabled !== false, spent: catSpent, settled: catSettled }
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

  const fixedPayRows = selectedPayFilter ? fixedExpenses.filter((f) => f.payMethod === selectedPayFilter).filter(fixedPayFilter) : []
  const payFiltered = selectedPayFilter
    ? sortTx(
        monthTx.filter((t) => t.type !== 'transfer' && t.payMethod === selectedPayFilter).filter(payTxFilter),
        currentSort,
      )
    : []
  const payTotalPages = Math.max(1, Math.ceil(payFiltered.length / PAGE_SIZE))
  const clampedPayPage = Math.min(Math.max(payPage, 0), payTotalPages - 1)
  const payPageStart = clampedPayPage * PAGE_SIZE
  const payPageTx = payFiltered.slice(payPageStart, payPageStart + PAGE_SIZE)

  // 분석 그래프는 생활 카테고리의 실제 사용만 보여준다. 개인용돈·경조사 같은 누적
  // 카테고리는 충전/잔액 관리 성격이라 이 그래프에서는 제외한다.
  const categoryUsage = livingCategories
    .map((cat) => {
      const spent = monthTx
        .filter((t) => t.type === 'living' && t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0)
      const refunded = monthTx
        .filter((t) => t.type === 'settlement' && t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0)
      return { ...cat, amount: Math.max(0, spent - refunded) }
    })
    .filter((cat) => cat.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const categoryUsageTotal = categoryUsage.reduce((sum, cat) => sum + cat.amount, 0)
  const maxCategoryUsage = Math.max(1, ...categoryUsage.map((cat) => cat.amount))
  const trendMonths = [addMonths(vKey, -2), addMonths(vKey, -1), vKey]
  const trendCategory = trendSelection?.kind === 'living'
    ? livingCategories.find((cat) => cat.id === trendSelection.categoryId)
    : null
  const trendData = trendSelection ? trendMonths.map((key) => {
    const rows = expandMonthTx(transactions, key)
    const matchesDetail = (t) => !trendDetailKey || (t.subcat?.trim() || '미분류') === trendDetailKey
    const gross = rows
      .filter((t) => t.type === 'living' && t.categoryId === trendSelection.categoryId && matchesDetail(t))
      .reduce((sum, t) => sum + t.amount, 0)
    const settledAmount = rows
      .filter((t) => t.type === 'settlement' && t.categoryId === trendSelection.categoryId && matchesDetail(t))
      .reduce((sum, t) => sum + t.amount, 0)
    return { key, amount: Math.max(0, gross - settledAmount) }
  }) : []
  const trendAverage = trendData.length ? trendData.reduce((sum, row) => sum + row.amount, 0) / trendData.length : 0
  const trendCurrent = trendData.at(-1)?.amount || 0
  const trendPrevious = trendData.at(-2)?.amount || 0
  const trendDelta = trendCurrent - trendPrevious
  const trendTitle = trendDetailKey || trendCategory?.name || ''
  const trendSubcategoryUsage = trendCategory
    ? [...new Set([
        ...(trendCategory.subcats || []),
        ...monthTx
          .filter((t) => t.categoryId === trendCategory.id && (t.type === 'living' || t.type === 'settlement'))
          .map((t) => t.subcat?.trim() || '미분류'),
      ])]
        .map((name, index) => {
          const matchesName = (t) => (t.subcat?.trim() || '미분류') === name
          const gross = monthTx
            .filter((t) => t.type === 'living' && t.categoryId === trendCategory.id && matchesName(t))
            .reduce((sum, t) => sum + t.amount, 0)
          const settledAmount = monthTx
            .filter((t) => t.type === 'settlement' && t.categoryId === trendCategory.id && matchesName(t))
            .reduce((sum, t) => sum + t.amount, 0)
          return { name, amount: Math.max(0, gross - settledAmount), color: SUBCATEGORY_COLORS[index % SUBCATEGORY_COLORS.length] }
        })
        .filter((item) => item.amount > 0)
        .sort((a, b) => b.amount - a.amount)
    : []
  const trendSubcategoryTotal = trendSubcategoryUsage.reduce((sum, item) => sum + item.amount, 0)
  let donutCursor = 0
  const trendDonutGradient = trendSubcategoryUsage.length
    ? `conic-gradient(${trendSubcategoryUsage.map((item) => {
        const start = donutCursor
        donutCursor += (item.amount / trendSubcategoryTotal) * 100
        return `${item.color} ${start}% ${donutCursor}%`
      }).join(', ')})`
    : 'rgba(19,42,51,.08)'

  function openLivingTrend(categoryId) {
    setTrendSelection({ kind: 'living', categoryId })
    setTrendDetailKey('')
  }

  return (
    <div className={ledgerOnly ? 'closing-ledger' : 'col-analysis'}>
      {!ledgerOnly && (
        <>
      <div id="analysisBlurContainer" className={!revealed ? 'hidden-state' : ''} style={{ position: 'relative' }} onClick={() => setRevealed((v) => !v)}>
        <div id="analysisBlurWrap" className={!revealed ? 'blur-hidden' : ''}>
          <div className="passbook">
            <div className="eyebrow">{displayMonth}월 분석</div>
            <div className="total-row">
              <span className="total-amt">{allocationsError ? '확인 필요' : fmt(income - expense)}</span>
              <span className="total-of">원 순합계 (수입 − 지출)</span>
            </div>
          </div>
          <div className="tx-list" style={{ margin: '14px 0' }}>
            <div className="tx-item">
              <span className="tx-merchant">가계 수입</span>
              <span className="tx-amt">{fmt(income)}원</span>
            </div>
            <div className="tx-item">
              <span className="tx-merchant">총 지출</span>
              <span className="tx-amt">{allocationsError ? '공동 합계 확인 필요' : `${fmt(expense)}원`}</span>
            </div>
            {settled > 0 && (
              <div className="tx-item">
                <span className="tx-merchant">정산받은 금액</span>
                <span className="tx-amt">+{fmt(settled)}원</span>
              </div>
            )}
          </div>
          {settled > 0 && !allocationsError && (
            <div style={{ fontSize: 11, opacity: 0.6, margin: '-8px 0 0 4px' }}>
              실지출 {fmt(rawExpense)}원 − 정산 {fmt(settled)}원 = 실질 지출 {fmt(expense)}원
            </div>
          )}
        </div>
        {!revealed && <div id="analysisBlurHint">탭하면 금액이 보여요</div>}
      </div>

      <p className="monthly-summary-note">가계 지출에는 누적 카테고리의 월 충전액을 반영해요. 아래 그래프는 실제 사용 내역을 기준으로 보여줘요.</p>

      <section className="analysis-chart-card">
        <div className="analysis-chart-head">
          <div>
            <span>{displayMonth}월 카테고리별 지출</span>
            <strong>{fmt(categoryUsageTotal)}원</strong>
          </div>
          <small>정산 반영</small>
        </div>
        {categoryUsage.length ? (
          <div className="analysis-category-chart">
            {categoryUsage.map((cat) => (
              <button className={`analysis-category-row${trendCategory?.id === cat.id ? ' active' : ''}`} key={cat.id} type="button" onClick={() => openLivingTrend(cat.id)}>
                <div className="analysis-category-label">
                  <span>{cat.name}</span>
                  <b>{fmt(cat.amount)}원</b>
                </div>
                <div className="analysis-chart-track">
                  <div style={{ width: `${(cat.amount / maxCategoryUsage) * 100}%`, background: cat.color || 'var(--gold)' }} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="tx-empty">{displayMonth}월 사용 내역이 없어요.</div>
        )}

        {trendCategory && (
          <div className="analysis-subcategory-panel">
            <div className="analysis-subcategory-title">
              <div>
                <b>{trendCategory.name} 구성</b>
                <span>하위 항목을 누르면 3개월 흐름이 바뀌어요</span>
              </div>
              {trendDetailKey && <button type="button" onClick={() => setTrendDetailKey('')}>전체 보기</button>}
            </div>
            {trendSubcategoryUsage.length ? (
              <div className="analysis-subcategory-content">
                <button
                  type="button"
                  className="analysis-donut"
                  style={{ background: trendDonutGradient }}
                  onClick={() => setTrendDetailKey('')}
                  aria-label={`${trendCategory.name} 전체 3개월 흐름 보기`}
                >
                  <span><small>실질 사용</small><b>{fmt(trendSubcategoryTotal)}원</b></span>
                </button>
                <div className="analysis-subcategory-legend">
                  {trendSubcategoryUsage.map((item) => (
                    <button
                      type="button"
                      key={item.name}
                      className={trendDetailKey === item.name ? 'active' : ''}
                      onClick={() => setTrendDetailKey(item.name)}
                    >
                      <i style={{ background: item.color }} />
                      <span>{item.name}</span>
                      <small>{Math.round((item.amount / trendSubcategoryTotal) * 100)}%</small>
                      <b>{fmt(item.amount)}원</b>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="tx-empty">하위 카테고리 사용 내역이 없어요.</div>
            )}
          </div>
        )}
      </section>

      {trendSelection && (
        <section className="analysis-trend-card">
          <div className="analysis-trend-head">
            <div>
              <span>{trendTitle} 최근 3개월</span>
              <strong>정산을 뺀 실질 사용액</strong>
            </div>
            <button type="button" aria-label="최근 3개월 분석 닫기" onClick={() => setTrendSelection(null)}>✕</button>
          </div>

          <div className="analysis-trend-months">
            {trendData.map((row) => (
              <div className="analysis-trend-month" key={row.key}>
                <span>{Number(row.key.slice(5, 7))}월</span>
                <b>{fmt(row.amount)}원</b>
              </div>
            ))}
          </div>

          <div className="analysis-trend-summary">
            <div><span>3개월 평균</span><b>{fmt(trendAverage)}원</b></div>
            <div className={trendDelta > 0 ? 'up' : trendDelta < 0 ? 'down' : ''}>
              <span>지난달 대비</span>
              <b>{trendDelta > 0 ? '+' : ''}{fmt(trendDelta)}원</b>
            </div>
          </div>
        </section>
      )}
        </>
      )}

      {ledgerOnly && (
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
              <span className="env-limit">{catSummary.budgetEnabled ? ` / ${fmt(catSummary.budget)}원` : ` ${displayMonth}월 실부담 · 예산 없음`}</span>
            </div>
            {!catSummary.budgetEnabled && <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>지출 {fmt(catSummary.spent)}원 − 정산 {fmt(catSummary.settled)}원</div>}
            {catSummary.budgetEnabled && <><div className="env-bar">
              <div className="env-bar-fill" style={{ width: Math.min(100, Math.max(0, catSummary.pct)) + '%', background: statusColor(catSummary.pct) }} />
            </div>
            <div className="env-remain" style={{ marginTop: 4 }}>
              {catSummary.remain >= 0 ? (
                <>
                  {displayMonth}월 <b>{fmt(catSummary.remain)}원</b> 더 쓸 수 있어요
                </>
              ) : (
                <>
                  <b style={{ color: statusColor(catSummary.pct) }}>{fmt(Math.abs(catSummary.remain))}원</b> 초과했어요
                </>
              )}
            </div>
            </>}
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
            {hasMultipleMembers && (
              <div className="type-toggle" style={{ marginBottom: 10 }}>
                {[
                  { key: 'all', label: '전체' },
                  { key: 'mine', label: '나' },
                ].map((b) => (
                  <button
                    key={b.key}
                    className={`type-btn${payOwnerFilter === b.key ? ' active' : ''}`}
                    onClick={() => {
                      setPayOwnerFilter(b.key)
                      setSelectedPayFilter(null)
                      setPayPage(0)
                    }}
                  >
                    {b.label}
                  </button>
                ))}
                <button
                  className={`type-btn${payOwnerFilter === 'other' ? ' active' : ''}`}
                  title="꾹 누르면 이름을 바꿀 수 있어요"
                  onMouseDown={handleOtherPressStart}
                  onMouseUp={handleOtherPressEnd}
                  onMouseLeave={handleOtherPressEnd}
                  onTouchStart={handleOtherPressStart}
                  onTouchEnd={handleOtherPressEnd}
                  onClick={handleOtherClick}
                >
                  {otherLabel}
                </button>
              </div>
            )}
            {payEntries.length > 0 && (
              <div className="tx-item" style={{ marginBottom: 10 }}>
                <span className="tx-merchant">{payOwnerFilter === 'all' ? '전체' : payOwnerFilter === 'mine' ? '나' : otherLabel} 합계</span>
                <span className="tx-amt">{fmt(payGrandTotal)}원</span>
              </div>
            )}
            {payEntries.length === 0 && <div className="tx-empty">{displayMonth}월 내역이 없어요.</div>}
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
                    <div className="tx-empty">{displayMonth}월 {selectedPayFilter} 지출 내역이 없어요.</div>
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
                        <div style={{ padding: '10px 16px 4px 16px', fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', opacity: 0.55, letterSpacing: 0.5 }}>{displayMonth}월 내역</div>
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
      )}
    </div>
  )
}
