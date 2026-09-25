-- ============================================================================
-- 가계부 v11: Android 카드 승인 알림 자동 수집
-- ============================================================================
-- 1) 로그인한 사용자가 1회용 원문 연결키를 발급한다.
-- 2) DB에는 연결키 원문이 아니라 SHA-256 해시만 보관한다.
-- 3) Edge Function(card-import)은 연결키로 사용자를 식별해 미분류 결제를 넣는다.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.card_import_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Android',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

alter table public.card_import_sources enable row level security;
drop policy if exists card_import_sources_owner_select on public.card_import_sources;
create policy card_import_sources_owner_select on public.card_import_sources for select
  using (user_id = auth.uid());
drop policy if exists card_import_sources_owner_delete on public.card_import_sources;
create policy card_import_sources_owner_delete on public.card_import_sources for delete
  using (user_id = auth.uid());

create table if not exists public.card_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references public.card_import_sources(id) on delete set null,
  card_name text not null,
  amount integer not null check (amount > 0),
  occurred_at timestamptz not null,
  installment_count integer check (installment_count is null or installment_count > 1),
  approval_status text not null default 'approved' check (approval_status in ('approved', 'cancelled')),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'ignored')),
  raw_title text,
  raw_text text,
  event_fingerprint text not null,
  resolved_transaction_id text references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_fingerprint)
);

create index if not exists card_imports_user_status_occurred_idx
  on public.card_imports(user_id, status, occurred_at desc);

alter table public.card_imports enable row level security;
drop policy if exists card_imports_owner_select on public.card_imports;
create policy card_imports_owner_select on public.card_imports for select
  using (user_id = auth.uid());
drop policy if exists card_imports_owner_update on public.card_imports;
create policy card_imports_owner_update on public.card_imports for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists card_imports_owner_delete on public.card_imports;
create policy card_imports_owner_delete on public.card_imports for delete
  using (user_id = auth.uid());

create or replace function public.create_card_import_source(p_name text default '내 Android')
returns table(source_id uuid, import_token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_source_id uuid := gen_random_uuid();
  v_token text := encode(gen_random_bytes(32), 'hex');
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  insert into public.card_import_sources(id, user_id, name, token_hash)
  values (
    v_source_id,
    auth.uid(),
    coalesce(nullif(trim(p_name), ''), '내 Android'),
    encode(digest(v_token, 'sha256'), 'hex')
  );

  return query select v_source_id, v_token;
end;
$$;

revoke all on function public.create_card_import_source(text) from public;
grant execute on function public.create_card_import_source(text) to authenticated;
