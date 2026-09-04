-- ============================================================================
-- 가계부 v6: 자산 현황(예적금/CMA/기타) 탭
-- ============================================================================
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run.
-- migration_v3(household)가 이미 적용되어 있어야 합니다.
--
-- 설계 요약
--   - asset_categories: 자산 종류(예적금/CMA/기타). household 공유, 카테고리 목록은 living_categories와
--     동일한 방식으로 씨딩된다.
--   - asset_entries: 각 카테고리에 대한 입금 기록(수기 입력). 카테고리별 현재 잔액 = 그 카테고리에
--     속한 entries.amount 합계. 거래 내역(transactions)과는 완전히 별개다.
--   - 둘 다 household 공유 (fixed_expenses/income_categories와 동일한 방식) — 부부 둘 다 보고 추가 가능.
-- ============================================================================

create table if not exists public.asset_categories (
  id text primary key,
  household_id uuid references public.households(id) on delete cascade,
  name text not null,
  color text,
  sort_order integer not null default 0
);
alter table public.asset_categories enable row level security;

drop policy if exists asset_categories_household on public.asset_categories;
create policy asset_categories_household on public.asset_categories for all
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

create table if not exists public.asset_entries (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  category_id text not null references public.asset_categories(id) on delete cascade,
  amount bigint not null,
  month text not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.asset_entries enable row level security;

drop policy if exists asset_entries_household on public.asset_entries;
create policy asset_entries_household on public.asset_entries for all
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));
