-- ============================================================================
-- 가계부 v5: 생활 카테고리 예산 "이 달부터" 변경 이력 + 고정지출 시작월
-- ============================================================================
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run.
-- migration_v2/v3가 이미 적용되어 있어야 합니다.
--
-- 변경 요약
--   - living_budget_changes: 생활 카테고리 예산도 누적 카테고리(envelope_rate_changes)와 똑같이
--     "이 달부터 얼마" 변경 이력을 쌓는 방식으로 바꾼다. living_categories.default_amount(=limit)는
--     "명시적 변경 이력이 없는 달에 쓰이는 기본값"으로 계속 쓰인다.
--     (기존 monthly_budgets의 "이번 달만 예외" 오버라이드 기능은 앱에서 더 이상 안 씀 — 테이블/데이터는
--     그대로 남겨두고 건드리지 않는다)
--   - fixed_expenses.start_month: 이 달 이전에는 이 고정지출이 존재하지 않았던 것으로 취급해서 과거
--     달에 소급 적용되지 않게 한다. 기존 행은 null로 남아 하위호환으로 계속 처음부터 적용된 것으로 취급.
-- ============================================================================

alter table public.fixed_expenses add column if not exists start_month text;

create table if not exists public.living_budget_changes (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id text not null references public.living_categories(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  effective_month text not null,
  amount integer not null,
  unique (category_id, effective_month)
);
alter table public.living_budget_changes enable row level security;
drop policy if exists living_budget_changes_household on public.living_budget_changes;
create policy living_budget_changes_household on public.living_budget_changes for all
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));
