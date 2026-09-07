// 금액 입력용 자체 숫자 키패드. OS 키보드에 기대지 않고 항상 동일하게 동작한다 (TxModal/자산 입력 공용).
// 입력 중인 금액을 키패드 자체에 표시해서, 시트 내용이 짧아 금액 칸이 키패드에 가려지는 화면에서도
// 항상 지금 입력한 값을 보면서 수정할 수 있게 한다.
export default function AmountKeypad({ open, display, onClose, onConfirm, onDigit, onBackspace, onToggleSign }) {
  if (!open) return null
  return (
    <>
      <div className="sheet-backdrop show" onClick={onClose} />
      <div className="amt-keypad">
        <div className="amt-keypad-preview">{display}</div>
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
