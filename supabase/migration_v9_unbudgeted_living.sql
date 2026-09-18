-- 예산 없이 지출/정산만 기록하는 부부 공용 생활 카테고리.
-- v3/v5 적용 후 Supabase SQL Editor에서 실행. 반복 실행해도 중복 추가하지 않는다.
begin;

alter table public.living_categories
  add column if not exists budget_enabled boolean not null default true;

insert into public.living_categories
  (id, user_id, household_id, name, color, limit_amount, default_amount, subcats, sort_order, budget_enabled)
select 'unbudgeted_' || replace(h.id::text, '-', ''), member.user_id, h.id,
  '비정기 지출', '#708090', 0, 0,
  array['병원·약국', '치과', '수리·교체', '앱·서비스', '기타'],
  (select coalesce(max(c.sort_order), 0) + 1 from public.living_categories c where c.household_id = h.id),
  false
from public.households h
cross join lateral (
  select hm.user_id from public.household_members hm
  where hm.household_id = h.id order by hm.joined_at, hm.user_id limit 1
) member
where not exists (
  select 1 from public.living_categories c
  where c.household_id = h.id and c.budget_enabled = false
)
on conflict (id) do nothing;

commit;

-- 실행 결과: 부부 공용 카테고리와 예산 제외 여부 확인.
select h.name as household_name, c.name as category_name,
  c.subcats, c.budget_enabled
from public.living_categories c
join public.households h on h.id = c.household_id
where c.budget_enabled = false
order by h.name, c.sort_order;
