// 금액 입력용 자체 숫자 키패드. OS 키보드에 기대지 않고 항상 동일하게 동작한다 (TxModal/자산 입력 공용).
export default function AmountKeypad({ open, onClose, onConfirm, onDigit, onBackspace, onToggleSign }) {
  if (!open) return null
  return (
    <>
      <div className="sheet-backdrop show" onClick={onClose} />
      <div className="amt-keypad">
        <button type="button" className="sheet-submit" onClick={onConfirm}>
          확인
        </button>
        <div className="amt-keypad-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" className="amt-key" onClick={() => onDigit(d)}>
              {d}
            </button>
          ))}
          <button type="button" className="amt-key amt-key-sign" onClick={onToggleSign}>
            -
          </button>
          <button type="button" className="amt-key" onClick={() => onDigit('0')}>
            0
          </button>
          <button type="button" className="amt-key" onClick={onBackspace}>
            ⌫
          </button>
        </div>
      </div>
    </>
  )
}
