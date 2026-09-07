-- ============================================================================
-- 가계부 v8: 고정지출도 "이 달부터" 금액 변경 이력 적용 (living_budget_changes와 동일한 패턴)
-- ============================================================================
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run.
-- migration_v3(household)/v5(living_budget_changes)가 이미 적용되어 있어야 합니다.
--
-- 변경 요약
--   - fixed_expenses.amount는 계속 "기본값"(명시적 변경 이력이 없는 달에 적용)으로 쓰인다.
--   - 특정 달부터 금액이 달라지면 이 테이블에 (fixed_expense_id, effective_month, amount) 행을 추가한다.
--   - 과거 달 계산은 그대로 유지되고, 지정한 달부터만 새 금액이 적용된다
--     (앱의 fixedAmountForMonth가 budgetAmountForMonth와 동일한 방식으로 조회).
--   - fixed_expenses가 household 공유이므로 이 테이블도 living_budget_changes와 동일하게 household 기준 RLS.
-- ============================================================================

create table if not exists public.fixed_expense_rate_changes (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fixed_expense_id text not null references public.fixed_expenses(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  effective_month text not null,
  amount integer not null,
  unique (fixed_expense_id, effective_month)
);
alter table public.fixed_expense_rate_changes enable row level security;
drop policy if exists fixed_expense_rate_changes_household on public.fixed_expense_rate_changes;
create policy fixed_expense_rate_changes_household on public.fixed_expense_rate_changes for all
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));
