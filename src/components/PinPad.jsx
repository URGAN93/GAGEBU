import { useState } from 'react'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

export default function PinPad({ pin, onSuccess, onClose, onWrong }) {
  const [digits, setDigits] = useState('')

  const handleKey = (key) => {
    if (key === '') return
    if (key === 'del') {
      setDigits((d) => d.slice(0, -1))
      return
    }
    const next = (digits + key).slice(0, pin.length)
    setDigits(next)
    if (next.length === pin.length) {
      if (next === pin) {
        setDigits('')
        onSuccess()
      } else {
        onWrong && onWrong()
        setTimeout(() => setDigits(''), 200)
      }
    }
  }

  return (
    <>
      <div className="sheet-backdrop show" onClick={onClose} />
      <div className="sheet pin-sheet show">
        <div className="sheet-handle" />
        <h3>PIN 입력</h3>
        <div className={`pin-dots${digits.length === pin.length ? ' pin-dots-shake' : ''}`}>
          {Array.from({ length: pin.length }).map((_, i) => (
            <span key={i} className={`pin-dot${i < digits.length ? ' filled' : ''}`} />
          ))}
        </div>
        <div className="pin-keypad">
          {KEYS.map((key, i) =>
            key === '' ? (
              <div key={i} className="pin-key pin-key-empty" />
            ) : (
              <button key={i} type="button" className="pin-key" onClick={() => handleKey(key)}>
                {key === 'del' ? '⌫' : key}
              </button>
            ),
          )}
        </div>
      </div>
    </>
  )
}
