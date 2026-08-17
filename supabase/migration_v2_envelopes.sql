-- ============================================================================
-- 가계부 v2 마이그레이션: 월별 예산 분리 + 개인용돈 Envelope화 + RLS 점검
-- ============================================================================
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run.
-- 이 스크립트는 여러 번 실행해도 안전하도록(idempotent) 작성되었습니다.
--
-- 실제 확인된 스키마:
--   - living_categories(id text pk, name, color, limit_amount, subcats text[], sort_order)
--   - irregular_envelopes(id text pk, name, color, monthly_amount, start_month, subcats text[], sort_order)
--   - transactions(id text pk, type, amount, merchant, category_id, subcat, pay_method,
--                   from_id, to_id, date, is_recurring, installment_count, installment_overrides jsonb)
--   - subcats 컬럼은 jsonb가 아니라 Postgres 배열(text[]) 타입 (2026-08-17 실제 에러로 확인: 42883 jsonb_array_elements_text(text[]) does not exist)
--   - 각 테이블에 user_id 컬럼이 없거나, 있다면 uuid 타입으로 auth.users(id)를 가리킴
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 0. user_id 컬럼 + RLS 보장 (이미 올바르게 되어 있으면 아무 것도 하지 않음)
-- ----------------------------------------------------------------------------
do $$
declare
  tbl text;
  the_uid uuid;
  remaining int;
begin
  -- 이 앱은 사실상 단일 사용자(panicaleweb@gmail.com) 앱이라 기존 행의 소유자를 이 계정으로 백필한다.
  select id into the_uid from auth.users where email = 'panicaleweb@gmail.com' limit 1;

  foreach tbl in array array['living_categories','irregular_envelopes','transactions','fixed_expenses','pay_methods'] loop

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'user_id'
    ) then
      execute format('alter table public.%I add column user_id uuid references auth.users(id) on delete cascade', tbl);
    end if;

    if the_uid is not null then
      execute format('update public.%I set user_id = $1 where user_id is null', tbl) using the_uid;
    end if;

    execute format('alter table public.%I alter column user_id set default auth.uid()', tbl);

    execute format('select count(*) from public.%I where user_id is null', tbl) into remaining;
    if remaining = 0 then
      execute format('alter table public.%I alter column user_id set not null', tbl);
    end if;

    execute format('alter table public.%I enable row level security', tbl);

    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = tbl and policyname = tbl || '_owner_all'
    ) then
      execute format(
        'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        tbl || '_owner_all', tbl
      );
    end if;

  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- STEP 1. living_categories: 카테고리 정의와 "기본" 예산을 분리
--   default_amount = 월별 override가 없을 때 쓰이는 기본 예산 (기존 limit_amount를 그대로 이관)
-- ----------------------------------------------------------------------------
alter table public.living_categories add column if not exists default_amount integer;
update public.living_categories set default_amount = limit_amount where default_amount is null;
alter table public.living_categories alter column default_amount set not null;
alter table public.living_categories add column if not exists is_active boolean not null default true;
alter table public.living_categories add column if not exists type text not null default 'living';
-- limit_amount 컬럼은 롤백 대비로 남겨두고, 앱은 더 이상 이 컬럼을 신뢰하지 않는다(default_amount 우선).


-- ----------------------------------------------------------------------------
-- STEP 2. monthly_budgets: 카테고리별 월별 예산 override
-- ----------------------------------------------------------------------------
create table if not exists public.monthly_budgets (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id text not null references public.living_categories(id) on delete cascade,
  year_month text not null,
  amount integer not null default 0,
  unique (user_id, category_id, year_month)
);
alter table public.monthly_budgets enable row level security;
drop policy if exists monthly_budgets_owner_all on public.monthly_budgets;
create policy monthly_budgets_owner_all on public.monthly_budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- STEP 3. 이관 RPC: 꾸밈비/문화·취미/비정기(경조사 제외) → 개인용돈 Envelope
--   - "한 번에 다 됐으면 즉시 return" 대신, 각 단계를 개별적으로 idempotent하게 만든 구조.
--     (allowance envelope 생성만 존재 체크로 1회 보장하고, 거래 재배정/카테고리 삭제/irregular1
--      개명은 매번 실행해도 안전한 WHERE 조건이라 재호출 시 자동으로 0건 처리되며 자가 치유됨)
--   - 이 방식이 이전 버전의 "living_categories에 allowance가 이미 있는 경우" 버그를 근본적으로 없앤다:
--     beauty/culture 거래 재배정이 allowance 생성 여부와 무관하게 항상 실행되기 때문.
--   - 함수 호출 전체가 하나의 트랜잭션으로 실행되므로, 중간에 에러가 나면 전부 롤백된다
--   - security invoker + auth.uid() 스코프라 호출한 사용자 자신의 데이터만 건드릴 수 있다
-- ----------------------------------------------------------------------------
create or replace function public.migrate_personal_allowance_v2()
returns void
language plpgsql
security invoker
as $$
declare
  uid uuid := auth.uid();
  beauty_row public.living_categories%rowtype;
  found_beauty boolean := false;
  living_allowance public.living_categories%rowtype;
  found_living_allowance boolean := false;
  old_irr public.irregular_envelopes%rowtype;
  found_old_irr boolean := false;
  allowance_exists boolean := false;
  allowance_color text;
  allowance_subcats text[];
  earliest_ym text;
  allowance_start_month text;
  cur_ym text := to_char(current_date, 'YYYY-MM');
begin
  if uid is null then
    raise exception 'migrate_personal_allowance_v2: auth.uid() is null (인증된 사용자만 호출 가능)';
  end if;

  select exists(
    select 1 from public.irregular_envelopes where user_id = uid and id = 'allowance'
  ) into allowance_exists;

  select * into beauty_row from public.living_categories where user_id = uid and id = 'beauty';
  found_beauty := FOUND;
  select * into living_allowance from public.living_categories where user_id = uid and id = 'allowance';
  found_living_allowance := FOUND;
  select * into old_irr from public.irregular_envelopes where user_id = uid and id = 'irregular1';
  found_old_irr := FOUND;

  -- 개인 용돈 Envelope가 아직 없을 때만 새로 만든다. 이미 있으면(이름/금액/색을 사용자가 직접 바꿨을 수도
  -- 있으므로) 절대 덮어쓰지 않고 그대로 둔다 — 이게 재호출 시 값이 리셋되지 않는 핵심 idempotency 지점.
  if not allowance_exists then
    allowance_color := coalesce(beauty_row.color, living_allowance.color, '#B04338');

    -- 기본 subcats 순서를 우선하고, 기존 irregular1/구버전 living-allowance의 커스텀 subcat이 있으면
    -- 경조사·가족선물을 제외하고 중복 없이 뒤에 이어붙인다.
    allowance_subcats := array['꾸밈','문화·취미','의류','자동차','생활용품','여행','기타'];
    if found_old_irr and old_irr.subcats is not null then
      allowance_subcats := allowance_subcats || array(
        select distinct x from unnest(old_irr.subcats) as x
        where x not in ('경조사','가족선물') and x <> all(allowance_subcats)
      );
    end if;
    if found_living_allowance and living_allowance.subcats is not null then
      allowance_subcats := allowance_subcats || array(
        select distinct x from unnest(living_allowance.subcats) as x
        where x <> all(allowance_subcats)
      );
    end if;

    -- 개인용돈으로 이동될 예정인 거래들 중 가장 이른 연-월을 start_month로 사용 (없으면 이번 달, 미래 월 금지)
    select min(left(t.date::text, 7)) into earliest_ym
    from public.transactions t
    where t.user_id = uid
      and (
        (t.type = 'living' and t.category_id in ('beauty','culture','allowance'))
        or (found_old_irr and t.type = 'irregular' and t.category_id = old_irr.id
            and coalesce(t.subcat,'') not in ('경조사','가족선물'))
      );

    allowance_start_month := coalesce(earliest_ym, cur_ym);
    if allowance_start_month > cur_ym then
      allowance_start_month := cur_ym;
    end if;

    insert into public.irregular_envelopes (id, user_id, name, color, monthly_amount, start_month, subcats, sort_order)
    values (
      'allowance', uid, '개인 용돈', allowance_color, 500000, allowance_start_month, allowance_subcats,
      (select coalesce(max(sort_order), 0) + 1 from public.irregular_envelopes where user_id = uid)
    );
  end if;

  -- beauty/culture/(구버전 living-)allowance 거래 -> irregular/allowance로 재배정.
  -- allowance가 이미 존재하던 케이스(②)에서도 항상 실행되므로 이전 버전의 누락 버그가 발생하지 않는다.
  -- 이미 옮겨진 거래는 WHERE 조건에 걸리지 않아 재호출해도 0건 처리로 안전하다.
  update public.transactions
    set type = 'irregular', category_id = 'allowance'
    where user_id = uid and type = 'living' and category_id in ('beauty','culture','allowance');

  -- beauty/culture/allowance living 카테고리만 정확히 삭제 (다른 카테고리는 절대 건드리지 않음).
  -- 이미 지워졌으면 0건 삭제로 안전하게 끝난다.
  delete from public.living_categories
    where user_id = uid and id in ('beauty','culture','allowance');

  -- 기존 irregular1: 경조사/가족선물이 아닌 거래는 개인용돈으로 재배정, envelope 자체는 경조사로 개명
  -- (id는 그대로 유지). old_irr가 없는 사용자는 이 블록을 건너뛰므로 예외가 발생하지 않는다.
  if found_old_irr then
    update public.transactions
      set category_id = 'allowance'
      where user_id = uid and type = 'irregular' and category_id = old_irr.id
        and coalesce(subcat, '') not in ('경조사', '가족선물');

    update public.irregular_envelopes
      set name = '경조사', subcats = array['경조사','가족선물']
      where user_id = uid and id = old_irr.id;
  end if;

  update public.living_categories
    set default_amount = coalesce(default_amount, limit_amount)
    where user_id = uid and default_amount is null;
end;
$$;

grant execute on function public.migrate_personal_allowance_v2() to authenticated;


-- ----------------------------------------------------------------------------
-- STEP 4. envelope_rate_changes: 누적 카테고리(경조사/개인용돈)의 "이 달부터" 월 충전액 변경 이력
--   - irregular_envelopes.monthly_amount는 "기본값"(명시적 변경 이력이 없는 달에 적용)으로 계속 쓰인다.
--   - 특정 달부터 다르게 적용하고 싶으면 이 테이블에 (envelope_id, effective_month, monthly_amount) 행을 넣는다.
--   - 누적 잔액 계산은 start_month부터 조회월까지 각 달마다 "그 달 시점에 유효한 가장 최근 변경분"을
--     찾아서 합산하는 방식으로 바뀐다 (index.html의 monthlyAmountForMonth/creditedForEnvelope 참고).
-- ----------------------------------------------------------------------------
create table if not exists public.envelope_rate_changes (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  envelope_id text not null references public.irregular_envelopes(id) on delete cascade,
  effective_month text not null,
  monthly_amount integer not null,
  unique (user_id, envelope_id, effective_month)
);
alter table public.envelope_rate_changes enable row level security;
drop policy if exists envelope_rate_changes_owner_all on public.envelope_rate_changes;
create policy envelope_rate_changes_owner_all on public.envelope_rate_changes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
