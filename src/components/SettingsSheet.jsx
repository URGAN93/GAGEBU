import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { fmt, isFixedActiveNow } from '../lib/calc.js'
import { useDragReorder } from '../hooks/useDragReorder.js'

function useDraft() {
  const [draft, setDraft] = useState({})
  function update(id, field, value) {
    setDraft((d) => ({ ...d, [id]: { ...d[id], [field]: value } }))
  }
  function get(item, field) {
    return draft[item.id]?.[field] ?? item[field]
  }
  return { draft, update, get, reset: () => setDraft({}) }
}

function LivingRow({ cat, draftApi, onDelete }) {
  return (
    <div className="manage-row" data-id={cat.id}>
      <div className="manage-row-top">
        <span className="mr-drag">⠿</span>
        <span className="manage-dot" style={{ background: cat.color }} />
        <input className="mr-name" value={draftApi.get(cat, 'name')} onChange={(e) => draftApi.update(cat.id, 'name', e.target.value)} />
        <button className="mr-del" onClick={() => onDelete(cat)}>
          ✕
        </button>
      </div>
      <div className="mr-line">
        <label>소분류</label>
        <input className="mr-sub" value={draftApi.get(cat, 'subcats_text') ?? (cat.subcats || []).join(', ')} placeholder="콤마로 구분" onChange={(e) => draftApi.update(cat.id, 'subcats_text', e.target.value)} />
      </div>
      <div className="mr-hint" style={{ fontSize: 11, opacity: 0.55, margin: '-4px 0 6px 0' }}>
        예산 금액은 예산 화면 카드의 ✎(연필) 아이콘을 눌러 수정하세요
      </div>
    </div>
  )
}

function IrregularRow({ env, draftApi, onDelete }) {
  return (
    <div className="manage-row" data-id={env.id}>
      <div className="manage-row-top">
        <span className="mr-drag">⠿</span>
        <span className="manage-dot" style={{ background: env.color }} />
        <input className="mr-name" value={draftApi.get(env, 'name')} onChange={(e) => draftApi.update(env.id, 'name', e.target.value)} />
        <button className="mr-del" onClick={() => onDelete(env)}>
          ✕
        </button>
      </div>
      <div className="mr-line">
        <label>세부 목적</label>
        <input className="mr-sub" value={draftApi.get(env, 'subcats_text') ?? (env.subcats || []).join(', ')} placeholder="콤마로 구분" onChange={(e) => draftApi.update(env.id, 'subcats_text', e.target.value)} />
      </div>
      <div className="mr-hint" style={{ fontSize: 11, opacity: 0.55, margin: '-4px 0 6px 0' }}>
        충전액은 예산 화면 카드의 ✎(연필) 아이콘을 눌러 수정하세요
      </div>
    </div>
  )
}

function IncomeRow({ cat, draftApi }) {
  return (
    <div className="manage-row" data-id={cat.id}>
      <div className="manage-row-top">
        <span className="manage-dot" style={{ background: cat.color || '#999' }} />
        <input className="mr-name" value={draftApi.get(cat, 'name')} onChange={(e) => draftApi.update(cat.id, 'name', e.target.value)} />
      </div>
      <div className="mr-line">
        <label>소분류</label>
        <input className="mr-sub" value={draftApi.get(cat, 'subcats_text') ?? (cat.subcats || []).join(', ')} placeholder="콤마로 구분" onChange={(e) => draftApi.update(cat.id, 'subcats_text', e.target.value)} />
      </div>
    </div>
  )
}

function FixedRow({ f, draftApi, onDelete }) {
  const active = isFixedActiveNow(f)
  return (
    <div className="manage-row" data-id={f.id} style={!active ? { opacity: 0.5 } : undefined}>
      <div className="manage-row-top">
        <input className="mr-name" value={draftApi.get(f, 'name')} onChange={(e) => draftApi.update(f.id, 'name', e.target.value)} />
        <span className="mr-amt-preview">
          {fmt(f.amount)}원{active ? '' : ' · 비활성'}
        </span>
        <button className="mr-del" onClick={() => onDelete(f)}>
          ✕
        </button>
      </div>
      <div className="mr-hint" style={{ fontSize: 11, opacity: 0.55, margin: '-4px 0 6px 0' }}>
        금액/결제수단/할부/마감은 예산 화면 카드에서 수정하세요
      </div>
    </div>
  )
}

function PayRow({ p, draftApi, onDelete }) {
  return (
    <div className="manage-row" data-id={p.id}>
      <div className="manage-row-top">
        <span className="mr-drag">⠿</span>
        <input className="mr-name" value={draftApi.get(p, 'name')} onChange={(e) => draftApi.update(p.id, 'name', e.target.value)} />
        <button className="mr-del" onClick={() => onDelete(p)}>
          ✕
        </button>
      </div>
    </div>
  )
}

export default function SettingsSheet() {
  const settingsSheetOpen = useAppStore((s) => s.settingsSheetOpen)
  const closeSettingsSheet = useAppStore((s) => s.closeSettingsSheet)
  const livingCategories = useAppStore((s) => s.livingCategories)
  const irregularEnvelopes = useAppStore((s) => s.irregularEnvelopes)
  const incomeCategories = useAppStore((s) => s.incomeCategories)
  const fixedExpenses = useAppStore((s) => s.fixedExpenses)
  const payMethods = useAppStore((s) => s.payMethods)
  const household = useAppStore((s) => s.household)
  const householdMembers = useAppStore((s) => s.householdMembers)

  const addLivingCategory = useAppStore((s) => s.addLivingCategory)
  const addIrregularEnvelope = useAppStore((s) => s.addIrregularEnvelope)
  const addFixedExpense = useAppStore((s) => s.addFixedExpense)
  const addPayMethod = useAppStore((s) => s.addPayMethod)
  const deleteLivingCategory = useAppStore((s) => s.deleteLivingCategory)
  const deleteIrregularEnvelope = useAppStore((s) => s.deleteIrregularEnvelope)
  const deleteFixedExpense = useAppStore((s) => s.deleteFixedExpense)
  const deletePayMethod = useAppStore((s) => s.deletePayMethod)
  const reorderList = useAppStore((s) => s.reorderList)
  const saveSettings = useAppStore((s) => s.saveSettings)
  const signOut = useAppStore((s) => s.signOut)

  const livingDraft = useDraft()
  const irregularDraft = useDraft()
  const incomeDraft = useDraft()
  const fixedDraft = useDraft()
  const payDraft = useDraft()

  // 원본은 설정 시트를 열 때마다 DOM을 state에서 새로 그렸다 — 즉 저장 안 하고 닫으면 편집 내용이 버려진다.
  // 여기서도 시트가 열릴 때마다 초안을 비워서 같은 동작을 재현한다.
  useEffect(() => {
    if (!settingsSheetOpen) return
    livingDraft.reset()
    irregularDraft.reset()
    incomeDraft.reset()
    fixedDraft.reset()
    payDraft.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsSheetOpen])

  const sortedFixed = useMemo(() => {
    return [...fixedExpenses].sort((a, b) => {
      const aActive = isFixedActiveNow(a)
      const bActive = isFixedActiveNow(b)
      return aActive === bActive ? 0 : aActive ? -1 : 1
    })
  }, [fixedExpenses])

  const livingContainerRef = useDragReorder((ids) => reorderList('livingCategories', ids))
  const irregularContainerRef = useDragReorder((ids) => reorderList('irregularEnvelopes', ids))
  const payContainerRef = useDragReorder((ids) => reorderList('payMethods', ids))

  async function handleDeleteLiving(cat) {
    if (!confirm(`"${cat.name}" 카테고리를 삭제할까요? 기존 지출 기록은 남아있어요.`)) return
    await deleteLivingCategory(cat.id)
  }
  async function handleDeleteIrregular(env) {
    if (!confirm(`"${env.name}" 누적 카테고리를 삭제할까요? 기존 지출 기록은 남아있어요.`)) return
    await deleteIrregularEnvelope(env.id)
  }
  async function handleDeleteFixed(f) {
    if (!confirm(`"${f.name}" 고정지출을 삭제할까요?`)) return
    await deleteFixedExpense(f.id)
  }
  async function handleDeletePay(p) {
    if (!confirm(`"${p.name}" 결제수단을 삭제할까요?`)) return
    await deletePayMethod(p.id)
  }
  function parseSubcats(text) {
    return text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  async function handleSave() {
    const living = {}
    livingCategories.forEach((c) => {
      const d = livingDraft.draft[c.id]
      if (!d) return
      living[c.id] = {
        name: d.name?.trim() || c.name,
        limit: d.limit != null ? Math.max(0, parseInt(d.limit, 10) || 0) : c.limit,
        subcats: d.subcats_text != null ? parseSubcats(d.subcats_text) : c.subcats,
      }
    })
    const irregular = {}
    irregularEnvelopes.forEach((e) => {
      const d = irregularDraft.draft[e.id]
      if (!d) return
      irregular[e.id] = {
        name: d.name?.trim() || e.name,
        monthlyAmount: d.monthlyAmount != null ? Math.max(0, parseInt(d.monthlyAmount, 10) || 0) : e.monthlyAmount,
        subcats: d.subcats_text != null ? parseSubcats(d.subcats_text) : e.subcats,
      }
    })
    const income = {}
    incomeCategories.forEach((c) => {
      const d = incomeDraft.draft[c.id]
      if (!d) return
      income[c.id] = {
        name: d.name?.trim() || c.name,
        subcats: d.subcats_text != null ? parseSubcats(d.subcats_text) : c.subcats,
      }
    })
    const fixed = {}
    fixedExpenses.forEach((f) => {
      const d = fixedDraft.draft[f.id]
      if (!d) return
      fixed[f.id] = { name: d.name?.trim() || f.name }
    })
    const pay = {}
    payMethods.forEach((p) => {
      const d = payDraft.draft[p.id]
      if (!d) return
      pay[p.id] = { name: d.name?.trim() || p.name }
    })

    await saveSettings({ living, irregular, income, fixed, pay })
  }

  return (
    <>
      <div className={`sheet-backdrop${settingsSheetOpen ? ' show' : ''}`} onClick={closeSettingsSheet} />
      <div className={`sheet${settingsSheetOpen ? ' show' : ''}`} style={{ zIndex: 32 }}>
        <div className="sheet-handle" />
        <h3>카테고리 설정</h3>

      <div className="settings-group">
        <h4>생활 카테고리 (매월 리셋)</h4>
        <div ref={livingContainerRef}>
          {livingCategories.map((cat) => (
            <LivingRow key={cat.id} cat={cat} draftApi={livingDraft} onDelete={handleDeleteLiving} />
          ))}
        </div>
        <button className="add-row-btn" onClick={addLivingCategory}>
          + 생활 카테고리 추가
        </button>
      </div>

      <div className="settings-group">
        <h4>누적 카테고리 (매달 자동 충전 · 이월)</h4>
        <div ref={irregularContainerRef}>
          {irregularEnvelopes.map((env) => (
            <IrregularRow key={env.id} env={env} draftApi={irregularDraft} onDelete={handleDeleteIrregular} />
          ))}
        </div>
        <button className="add-row-btn" onClick={addIrregularEnvelope}>
          + 누적 카테고리 추가
        </button>
      </div>

      <div className="settings-group">
        <h4>고정지출 (매달 반복, 한도 없음)</h4>
        <div>
          {sortedFixed.map((f) => (
            <FixedRow key={f.id} f={f} draftApi={fixedDraft} onDelete={handleDeleteFixed} />
          ))}
        </div>
        <button className="add-row-btn" onClick={addFixedExpense}>
          + 고정지출 추가
        </button>
      </div>

      <div className="settings-group">
        <h4>수입 카테고리</h4>
        <div>
          {incomeCategories.map((cat) => (
            <IncomeRow key={cat.id} cat={cat} draftApi={incomeDraft} />
          ))}
        </div>
      </div>

      <div className="settings-group">
        <h4>결제수단</h4>
        <div ref={payContainerRef}>
          {payMethods.map((p) => (
            <PayRow key={p.id} p={p} draftApi={payDraft} onDelete={handleDeletePay} />
          ))}
        </div>
        <button className="add-row-btn" onClick={addPayMethod}>
          + 결제수단 추가
        </button>
      </div>

      {household && (
        <div className="settings-group">
          <h4>우리 가계부</h4>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
            <div>{household.name}</div>
            <div>
              초대 코드: <b style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{household.inviteCode || '-'}</b> (배우자에게 공유해서 가입시키세요)
            </div>
            <div>구성원 {householdMembers.length}명</div>
          </div>
        </div>
      )}

      <button className="sheet-submit" onClick={handleSave}>
        저장하기
      </button>
      <button className="sheet-delete" style={{ marginTop: 10 }} onClick={signOut}>
        로그아웃
      </button>
      </div>
    </>
  )
}
