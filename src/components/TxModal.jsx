import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { elapsedMonths, installmentBaseAmount, fmt, todayKST } from '../lib/calc.js'

const TYPE_BUTTONS = [
  { type: 'living', label: '지출' },
  { type: 'income', label: '수입' },
  { type: 'settlement', label: '정산' },
]

export default function TxModal() {
  const txSheetOpen = useAppStore((s) => s.txSheetOpen)
  const editingTxId = useAppStore((s) => s.editingTxId)
  const editingInstMonth = useAppStore((s) => s.editingInstMonth)
  const closeTxSheet = useAppStore((s) => s.closeTxSheet)
  const transactions = useAppStore((s) => s.transactions)
  const livingCategories = useAppStore((s) => s.livingCategories)
  const irregularEnvelopes = useAppStore((s) => s.irregularEnvelopes)
  const incomeCategories = useAppStore((s) => s.incomeCategories)
  const payMethods = useAppStore((s) => s.payMethods)
  const selectedCalDate = useAppStore((s) => s.selectedCalDate)
  const submitTransaction = useAppStore((s) => s.submitTransaction)
  const updateInstallmentOverride = useAppStore((s) => s.updateInstallmentOverride)
  const deleteTransaction = useAppStore((s) => s.deleteTransaction)
  const addBonusToAllowance = useAppStore((s) => s.addBonusToAllowance)
  const findCatPool = useAppStore((s) => s.findCatPool)

  const [selectedType, setSelectedType] = useState('living')
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedTo, setSelectedTo] = useState(null)
  const [selectedPay, setSelectedPay] = useState(null)
  const [fAmount, setFAmount] = useState('')
  const [fMerchant, setFMerchant] = useState('')
  const [fDate, setFDate] = useState('')
  const [fSubcat, setFSubcat] = useState('')
  const [fInstallment, setFInstallment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const amountRef = useRef(null)

  const editing = editingTxId ? transactions.find((t) => t.id === editingTxId) : null

  // 열릴 때마다 금액 입력에 포커스 (슬라이드업 애니메이션이 끝날 무렵)
  useEffect(() => {
    if (!txSheetOpen) return
    const timer = setTimeout(() => amountRef.current && amountRef.current.focus(), 250)
    return () => clearTimeout(timer)
  }, [txSheetOpen])

  // 시트가 열릴 때(또는 편집 대상이 바뀔 때) 폼을 원본 openSheet()와 동일한 규칙으로 채운다.
  useEffect(() => {
    if (!txSheetOpen) return

    if (editing && editingInstMonth) {
      setSelectedType(editing.type)
      const override = editing.installmentOverrides && editing.installmentOverrides[editingInstMonth]
      const instIdx = elapsedMonths(editing.date.slice(0, 7), editingInstMonth)
      setFAmount(String(override != null ? override : installmentBaseAmount(editing, instIdx)))
      return
    }

    const type = editing ? (editing.type === 'irregular' ? 'living' : editing.type) : 'living'
    setSelectedType(type)
    setFAmount(editing ? String(editing.amount) : '')
    setFDate(editing ? editing.date : selectedCalDate || todayKST())
    setFInstallment(editing && editing.installmentCount > 1 ? String(editing.installmentCount) : '')

    if (type === 'transfer') {
      setSelectedTo(editing ? editing.toId : null)
      setSelectedPay(null)
      setSelectedCat(null)
      setFMerchant(editing ? editing.merchant || '' : '')
      setFSubcat('')
    } else if (type === 'income' || type === 'settlement') {
      setFMerchant(editing ? editing.merchant || '' : '')
      setFSubcat(editing ? editing.subcat || '' : '')
      setSelectedCat(editing ? editing.categoryId : null)
      setSelectedPay(null)
      setSelectedTo(null)
    } else {
      setFMerchant(editing ? editing.merchant : '')
      setFSubcat(editing ? editing.subcat || '' : '')
      setSelectedCat(editing ? editing.categoryId : null)
      setSelectedPay(editing ? editing.payMethod || null : null)
      setSelectedTo(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txSheetOpen, editingTxId, editingInstMonth])

  // sheet 엘리먼트 자체는 항상 DOM에 남겨두고 'show' 클래스만 토글한다 (원본과 동일한 슬라이드업/다운 트랜지션을 위해).
  const isTransfer = selectedType === 'transfer'
  const isIncome = selectedType === 'income'
  const isSettlement = selectedType === 'settlement'

  const envelopeList =
    selectedType === 'income'
      ? incomeCategories
      : selectedType === 'living' || selectedType === 'settlement'
        ? [...livingCategories, ...irregularEnvelopes]
        : irregularEnvelopes
  const isCombinedCat = selectedType === 'living' || selectedType === 'settlement'
  const subPresets = (envelopeList.find((c) => c.id === selectedCat) || {}).subcats || []
  const selectedFrom = irregularEnvelopes[0] ? irregularEnvelopes[0].id : null

  let sheetTitle
  let submitLabel
  if (editingInstMonth) {
    sheetTitle = `${editingInstMonth.slice(5, 7).replace(/^0/, '')}월 할부 회차 금액 수정`
    submitLabel = '수정하기'
  } else {
    sheetTitle = editingTxId
      ? isTransfer
        ? '이체 수정'
        : isIncome
          ? '수입 수정'
          : isSettlement
            ? '정산 수정'
            : '지출 수정'
      : isTransfer
        ? '이체'
        : isIncome
          ? '수입 추가'
          : isSettlement
            ? '정산 추가'
            : '지출 추가'
    submitLabel = editingTxId ? '수정하기' : isTransfer ? '이체하기' : isSettlement ? '정산 추가하기' : '추가하기'
  }

  const amt = parseInt(fAmount, 10)
  const submitDisabled = editingInstMonth
    ? !(amt > 0)
    : isTransfer
      ? !(amt > 0 && selectedTo && fDate && irregularEnvelopes.length > 0)
      : !(amt > 0 && selectedCat && fDate)

  function handleTypeClick(type) {
    setSelectedType(type)
    setSelectedCat(null)
    setSelectedTo(null)
    setSelectedPay(null)
  }

  async function handleSubmit() {
    if (submitDisabled || submitting) return
    setSubmitting(true)
    try {
      if (editingInstMonth) {
        await updateInstallmentOverride(editingTxId, editingInstMonth, parseInt(fAmount, 10))
        closeTxSheet()
        return
      }

      let payload
      if (isTransfer) {
        const fromEnv = irregularEnvelopes.find((e) => e.id === selectedFrom)
        const toCat = livingCategories.find((c) => c.id === selectedTo)
        payload = {
          amount: parseInt(fAmount, 10),
          type: 'transfer',
          fromId: selectedFrom,
          toId: selectedTo,
          merchant: fMerchant.trim() || `${fromEnv ? fromEnv.name : ''} → ${toCat ? toCat.name : ''}`,
          date: fDate,
        }
      } else if (isIncome) {
        payload = { amount: parseInt(fAmount, 10), merchant: fMerchant.trim(), type: 'income', categoryId: selectedCat, subcat: fSubcat.trim(), date: fDate }
      } else if (isSettlement) {
        payload = { amount: parseInt(fAmount, 10), merchant: fMerchant.trim(), type: 'settlement', categoryId: selectedCat, subcat: fSubcat.trim(), date: fDate }
      } else {
        payload = {
          amount: parseInt(fAmount, 10),
          merchant: fMerchant.trim(),
          type: findCatPool(selectedCat) || 'living',
          categoryId: selectedCat,
          subcat: fSubcat.trim(),
          payMethod: selectedPay,
          date: fDate,
          installmentCount: parseInt(fInstallment, 10) > 1 ? parseInt(fInstallment, 10) : null,
          installmentOverrides: editingTxId && parseInt(fInstallment, 10) > 1 ? editing?.installmentOverrides || null : null,
        }
      }

      const result = await submitTransaction(editingTxId, payload)
      closeTxSheet()

      // 추가수입(상여금/연주비/기타) 카테고리로 신규 수입을 넣었으면, 10%를 개인용돈에 적립할지 매번 확인한다 (일회성)
      if (result.ok && !editingTxId && isIncome) {
        const incomeCatName = (incomeCategories.find((c) => c.id === payload.categoryId) || {}).name
        if (incomeCatName === '추가수입') {
          const bonusAmount = Math.round(payload.amount * 0.1)
          const input = prompt(`개인용돈에 10%(${fmt(bonusAmount)}원)를 적립할까요? 원치 않으면 취소, 금액을 바꾸려면 수정 후 확인을 눌러주세요.`, bonusAmount)
          if (input !== null) {
            const bonusAmt = Math.max(0, parseInt(input, 10) || 0)
            if (bonusAmt > 0) await addBonusToAllowance(bonusAmt, payload.date.slice(0, 7), `${payload.merchant || payload.subcat || '추가수입'} 10%`)
          }
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!editingTxId) return
    await deleteTransaction(editingTxId)
    closeTxSheet()
  }

  return (
    <>
      <div className={`sheet-backdrop${txSheetOpen ? ' show' : ''}`} onClick={closeTxSheet} />
      <div className={`sheet${txSheetOpen ? ' show' : ''}`}>
        <div className="sheet-handle" />
        <h3>{sheetTitle}</h3>

        {!editingInstMonth && (
          <div className="type-toggle">
            {TYPE_BUTTONS.map((b) => (
              <button key={b.type} className={`type-btn${selectedType === b.type ? ' active' : ''}`} onClick={() => handleTypeClick(b.type)}>
                {b.label}
              </button>
            ))}
          </div>
        )}

        <div className="field">
          <label>금액</label>
          <input ref={amountRef} type="number" inputMode="numeric" placeholder="0" value={fAmount} onChange={(e) => setFAmount(e.target.value)} />
        </div>

        {!editingInstMonth && (
          <>
            {!isTransfer && (
              <div className="field">
                <label>가맹점 / 내용</label>
                <input type="text" placeholder="예) 스타벅스" value={fMerchant} onChange={(e) => setFMerchant(e.target.value)} />
              </div>
            )}

            <div className="field">
              <label>날짜</label>
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </div>

            {!isTransfer && (
              <div className="field">
                <label>{isSettlement ? '어느 카테고리에서 정산됐나요' : '카테고리'}</label>
                <div className="cat-choices">
                  {envelopeList.map((cat) => {
                    const isIrregular = isCombinedCat && irregularEnvelopes.some((e) => e.id === cat.id)
                    return (
                      <div
                        key={cat.id}
                        className={`cat-chip${selectedCat === cat.id ? ' active' : ''}`}
                        style={isIrregular ? { borderStyle: 'dashed' } : undefined}
                        title={isIrregular ? '누적 카테고리' : undefined}
                        onClick={() => setSelectedCat(cat.id)}
                      >
                        {cat.name}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!isTransfer && (
              <div className="field">
                <label>
                  소분류 <span style={{ fontWeight: 400, opacity: 0.6 }}>(선택)</span>
                </label>
                <div className="cat-choices">
                  {subPresets.map((name) => (
                    <div key={name} className={`cat-chip${fSubcat.trim() === name ? ' active' : ''}`} onClick={() => setFSubcat(name)}>
                      {name}
                    </div>
                  ))}
                </div>
                <input type="text" placeholder="직접 입력도 가능" style={{ marginTop: 8 }} value={fSubcat} onChange={(e) => setFSubcat(e.target.value)} />
              </div>
            )}

            {!(isTransfer || isIncome || isSettlement) && (
              <div className="field">
                <label>
                  결제수단 <span style={{ fontWeight: 400, opacity: 0.6 }}>(선택)</span>
                </label>
                <div className="cat-choices">
                  {payMethods.map((p) => (
                    <div key={p.id} className={`cat-chip${selectedPay === p.name ? ' active' : ''}`} onClick={() => setSelectedPay((cur) => (cur === p.name ? null : p.name))}>
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!(isTransfer || isIncome || isSettlement) && (
              <div className="field">
                <label>
                  할부 <span style={{ fontWeight: 400, opacity: 0.6 }}>(선택, 개월 · 비우면 일시불)</span>
                </label>
                <input type="number" min="1" max="36" placeholder="일시불" value={fInstallment} onChange={(e) => setFInstallment(e.target.value)} />
              </div>
            )}

            {isTransfer && (
              <div className="field">
                <label>어디로 (생활 카테고리)</label>
                <div className="cat-choices">
                  {livingCategories.map((cat) => (
                    <div key={cat.id} className={`cat-chip${selectedTo === cat.id ? ' active' : ''}`} onClick={() => setSelectedTo(cat.id)}>
                      {cat.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <button className="sheet-submit" disabled={submitDisabled || submitting} onClick={handleSubmit}>
          {submitLabel}
        </button>
        {!editingInstMonth && editingTxId && (
          <button className="sheet-delete" onClick={handleDelete}>
            이 지출 삭제하기
          </button>
        )}
      </div>
    </>
  )
}
