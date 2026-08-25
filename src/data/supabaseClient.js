import { createClient } from '@supabase/supabase-js'

export const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export const PALETTE = ['#3E7A55', '#3B6E8F', '#B04338', '#B98A2E', '#6B5B95', '#8A8577', '#4B7B7F', '#9C5B3C']
