import { createClient } from '@supabase/supabase-js'

export const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export const PALETTE = ['#3E7A55', '#3B6E8F', '#B04338', '#B98A2E', '#6B5B95', '#8A8577', '#4B7B7F', '#9C5B3C']

// 웹 푸시용 VAPID 공개키 (비밀키 아님, 클라이언트에 노출돼도 안전함).
// supabase/functions/notify-cron/index.ts의 VAPID_PUBLIC_KEY와 반드시 짝이 맞아야 한다 — 한쪽만 바꾸면 푸시가 깨진다.
export const VAPID_PUBLIC_KEY = 'BLuoO7TPsoi67k0y6jV7oFf0nVhKXxkjRn0P32FXEK6esmHKbuZG3anC0tJEjGiHUVJOisKyJfeHAJ64ogjIu3M'
