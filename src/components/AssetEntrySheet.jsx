import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { monthKey } from '../lib/calc.js'
import { appendDigit, backspaceAmount, toggleSign, formatAmountDisplay } from '../lib/amountInput.js'
import AmountKeypad from './AmountKeypad.jsx'

export default function AssetEntrySheet({ categoryId, onClose }) {
  const addAssetEntry = useAppStore((s) => s.addAssetEntry)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [keypadOpen, setKeypadOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const open = !!categoryId

  useEffect(() => {
    if (!open) return
    setAmount('')
    setNote('')
    const timer = setTimeout(() => setKeypadOpen(true), 250)
    return () => clearTimeout(timer)
  }, [categoryId, open])

  const amt = parseInt(amount, 10)

  async function handleSubmit() {
    if (!amt || submitting) return
    setSubmitting(true)
    try {
      await addAssetEntry(categoryId, amt, monthKey(new Date()), note.trim())
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className={`sheet-backdrop${open ? ' show' : ''}`} onClick={onClose} />
      <div className={`sheet${open ? ' show' : ''}`}>
        <div className="sheet-handle" />
        <h3>입금(조정) 추가</h3>
        {open && (
          <>
            <div className="field">
              <label>
                금액 <span style={{ fontWeight: 400, opacity: 0.6 }}>(빼야 하면 -를 눌러주세요)</span>
              </label>
              <button type="button" className="amount-display" onClick={() => setKeypadOpen(true)}>
                {formatAmountDisplay(amount)}
              </button>
            </div>
            <div className="field">
              <label>
                메모 <span style={{ fontWeight: 400, opacity: 0.6 }}>(선택)</span>
              </label>
              <input type="text" placeholder="예) 만기 이자" value={note} onFocus={() => setKeypadOpen(false)} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button className="sheet-submit" disabled={!amt || submitting} onClick={handleSubmit}>
              추가하기
            </button>
          </>
        )}
      </div>

      <AmountKeypad
        open={open && keypadOpen}
        onClose={() => setKeypadOpen(false)}
        onConfirm={() => setKeypadOpen(false)}
        onDigit={(d) => setAmount((cur) => appendDigit(cur, d))}
        onBackspace={() => setAmount((cur) => backspaceAmount(cur))}
        onToggleSign={() => setAmount((cur) => toggleSign(cur))}
      />
    </>
  )
}
