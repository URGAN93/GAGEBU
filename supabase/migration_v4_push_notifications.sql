-- ============================================================================
-- 가계부 v4: 웹 푸시 알림 (매일 밤 리마인드 + 예산 임박 알림)
-- ============================================================================
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run.
-- migration_v2/v3가 이미 적용되어 있어야 합니다.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- push_subscriptions: 브라우저가 발급한 푸시 구독 정보 (개인 소유, 절대 공유 안 함)
-- ----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_owner on public.push_subscriptions;
create policy push_subscriptions_owner on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- notification_settings: 사용자별 알림 설정 (개인 소유)
-- ----------------------------------------------------------------------------
create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_reminder_enabled boolean not null default true,
  daily_reminder_hour int not null default 21,     -- KST 기준 0~23시
  budget_alert_enabled boolean not null default true,
  budget_alert_threshold int not null default 85,  -- %
  updated_at timestamptz not null default now()
);
alter table public.notification_settings enable row level security;
drop policy if exists notification_settings_owner on public.notification_settings;
create policy notification_settings_owner on public.notification_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- budget_alert_log: 이번 달에 이미 임계값 알림을 보낸 카테고리 기록 (중복 알림 방지)
-- ----------------------------------------------------------------------------
create table if not exists public.budget_alert_log (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id text not null,
  year_month text not null,
  alerted_at timestamptz not null default now(),
  unique (user_id, category_id, year_month)
);
alter table public.budget_alert_log enable row level security;
drop policy if exists budget_alert_log_owner on public.budget_alert_log;
create policy budget_alert_log_owner on public.budget_alert_log for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
