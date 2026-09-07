-- ============================================================================
-- 가계부 v7: income_categories를 household 공유 → 개인(user_id) 소유로 전환
-- ============================================================================
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run.
-- migration_v3(household)가 이미 적용되어 있어야 합니다.
--
-- 배경
--   - v3까지는 income_categories(정기수입/추가수입)가 household 전체가 공유하는 "템플릿"이었다
--     (한 사람이 이름/소분류를 바꾸면 배우자 화면에도 그대로 반영됨).
--   - 이제 pay_methods와 동일하게 각자 자기 목록을 따로 관리하도록 바꾼다 (이름/소분류를 서로
--     다르게 커스터마이즈 가능). 수입 "거래 내역" 자체의 household 공유 여부는 건드리지 않는다 —
--     거래는 여전히 household_id로 배우자에게도 보인다 (categoryHouseholdId는 변경 없음).
--
-- 데이터 보존
--   - 이미 household 구성원이 공유해서 쓰고 있던 기존 행은, 구성원 중 한 명(가입 순서상 첫 번째)이
--     그대로 이어받고, 나머지 구성원에게는 동일한 이름/소분류로 된 개인 소유 복사본을 새 id로
--     만들어준다 — 마이그레이션 직후엔 화면에 보이는 값이 똑같고, 이후부터 각자 독립적으로 수정 가능.
--   - 여러 번 실행해도 안전(idempotent): 이미 user_id가 채워진 행은 건너뛰고, 복사본은 id 충돌 시
--     삽입을 건너뛴다.
-- ============================================================================

alter table public.income_categories add column if not exists user_id uuid references auth.users(id) on delete cascade;

do $$
declare
  cat record;
  mem record;
  is_first boolean;
  new_id text;
begin
  for cat in select * from public.income_categories where user_id is null loop
    is_first := true;
    for mem in
      select user_id from public.household_members
      where household_id = cat.household_id
      order by joined_at
    loop
      if is_first then
        update public.income_categories set user_id = mem.user_id where id = cat.id;
        is_first := false;
      else
        new_id := cat.id || '_' || replace(mem.user_id::text, '-', '');
        insert into public.income_categories (id, household_id, user_id, name, color, subcats, sort_order)
        values (new_id, cat.household_id, mem.user_id, cat.name, cat.color, cat.subcats, cat.sort_order)
        on conflict (id) do nothing;
      end if;
    end loop;
  end loop;
end $$;

drop policy if exists income_categories_household on public.income_categories;
drop policy if exists income_categories_owner on public.income_categories;
create policy income_categories_owner on public.income_categories for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
