import { useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'

function seenLabel(value) {
  if (!value) return '아직 수신 없음'
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
export default function CardImportSettings() {
  const sources = useAppStore((s) => s.cardImportSources)
  const createSource = useAppStore((s) => s.createCardImportSource)
  const removeSource = useAppStore((s) => s.removeCardImportSource)
  const showToast = useAppStore((s) => s.showToast)
  const [creating, setCreating] = useState(false)
  const [connection, setConnection] = useState(null)

  async function handleCreate() {
    if (creating) return
    setCreating(true)
    const result = await createSource('내 갤럭시')
    setCreating(false)
    if (result.ok) setConnection({ endpoint: result.endpoint, token: result.token })
  }

  async function copy(value, label) {
    await navigator.clipboard.writeText(value)
    showToast(`${label}을 복사했어요`)
  }

  async function handleRemove(source) {
    if (!confirm(`"${source.name}" 카드 자동등록 연결을 해제할까요?`)) return
    await removeSource(source.id)
  }

  return (
    <div className="settings-group card-import-settings">
      <h4>카드 자동등록</h4>
      <p className="card-import-settings-desc">Android 카드 승인 알림을 미분류 결제함으로 가져와요. 연결키는 생성 직후 한 번만 보여요.</p>

      {sources.map((source) => (
        <div className="card-source-row" key={source.id}>
          <div>
            <strong>{source.name}</strong>
            <small>최근 수신 · {seenLabel(source.lastSeenAt)}</small>
          </div>
          <button onClick={() => handleRemove(source)}>연결 해제</button>
        </div>
      ))}

      <button className="add-row-btn" disabled={creating} onClick={handleCreate}>
        {creating ? '연결키 만드는 중…' : '+ Android 연결키 만들기'}
      </button>

      {connection && (
        <div className="card-import-connection">
          <strong>MacroDroid HTTP 요청 설정</strong>
          <label>POST 수신 주소</label>
          <div className="card-import-copy-row">
            <input readOnly value={connection.endpoint} />
            <button onClick={() => copy(connection.endpoint, '수신 주소')}>복사</button>
          </div>
          <label>헤더 `x-import-token` 값</label>
          <div className="card-import-copy-row">
            <input readOnly value={connection.token} />
            <button onClick={() => copy(connection.token, '연결키')}>복사</button>
          </div>
          <p>본문은 JSON 형식으로 알림 제목과 알림 텍스트를 넣으면 돼요. 이 화면을 닫기 전에 연결키를 MacroDroid에 붙여넣어주세요.</p>
        </div>
      )}
    </div>
  )
}
