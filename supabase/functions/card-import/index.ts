import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseCardNotification } from './parser.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST 요청만 지원합니다' }, 405)

  const importToken = req.headers.get('x-import-token')?.trim()
  if (!importToken) return json({ ok: false, error: '연결키가 없습니다' }, 401)

  const tokenHash = await sha256(importToken)
  const { data: source, error: sourceError } = await sb
    .from('card_import_sources')
    .select('id,user_id')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (sourceError) return json({ ok: false, error: '연결 정보를 확인하지 못했습니다' }, 500)
  if (!source) return json({ ok: false, error: '유효하지 않은 연결키입니다' }, 401)

  let payload: { title?: string; text?: string; receivedAt?: string }
  const contentType = req.headers.get('content-type')?.toLowerCase() || ''
  if (contentType.includes('text/plain')) {
    const text = (await req.text()).trim()
    if (!text) return json({ ok: false, error: '알림 내용이 없습니다' }, 400)
    payload = { text }
  } else {
    try {
      payload = await req.json()
    } catch {
      return json({ ok: false, error: 'JSON 또는 일반 텍스트 본문이 필요합니다' }, 400)
    }
  }

  const receivedAt = payload.receivedAt ? new Date(payload.receivedAt) : new Date()
  const safeReceivedAt = Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt
  const parsed = parseCardNotification(payload.title || '', payload.text || '', safeReceivedAt)
  if (!parsed) return json({ ok: false, error: '지원하는 카드 승인 알림 형식이 아닙니다' }, 422)

  const fingerprint = await sha256([
    source.user_id,
    parsed.cardName,
    parsed.approvalStatus,
    parsed.amount,
    parsed.occurredAt,
    parsed.installmentCount || 1,
  ].join('|'))

  const { data: inserted, error: insertError } = await sb
    .from('card_imports')
    .insert({
      user_id: source.user_id,
      source_id: source.id,
      card_name: parsed.cardName,
      amount: parsed.amount,
      occurred_at: parsed.occurredAt,
      installment_count: parsed.installmentCount,
      approval_status: parsed.approvalStatus,
      raw_title: payload.title || null,
      raw_text: payload.text || null,
      event_fingerprint: fingerprint,
    })
    .select('id')
    .single()

  if (insertError && insertError.code !== '23505') {
    return json({ ok: false, error: '결제 내역을 저장하지 못했습니다' }, 500)
  }

  await sb.from('card_import_sources').update({ last_seen_at: new Date().toISOString() }).eq('id', source.id)
  return json({ ok: true, duplicate: insertError?.code === '23505', id: inserted?.id || null, payment: parsed })
})
