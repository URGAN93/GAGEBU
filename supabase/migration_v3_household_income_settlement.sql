-- ============================================================================
-- 가계부 v3: 수입 카테고리 분리 + 정산(settlement) + 보너스→개인용돈 + 부부 공동가계부(household)
-- ============================================================================
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run.
-- migration_v2_envelopes.sql이 이미 적용되어 있어야 합니다 (living_categories/irregular_envelopes/
-- transactions/fixed_expenses/pay_methods에 user_id + RLS, monthly_budgets, envelope_rate_changes 등).
-- 이 스크립트도 여러 번 실행해도 안전하도록(idempotent) 작성했습니다.
--
-- 설계 요약
--   - households / household_members: 부부(가족) 단위 그룹
--   - living_categories / monthly_budgets / fixed_expenses / income_categories: household 공유
--   - irregular_envelopes: scope 컬럼으로 구분
--       scope='household' → 경조사류, household 전체가 공유 (예시의 "경조사 잔액 800,000")
--       scope='personal'  → 개인용돈류, user_id 소유자만 접근 (예시의 "내 개인용돈"/"와이프 개인용돈")
--   - transactions: user_id(누가 입력했는지) + household_id(공유 카테고리 거래면 세팅, 개인 envelope
--     거래면 NULL 유지) 둘 다 가짐 → 개인용돈 지출은 배우자에게 절대 안 보임
--   - 정산(settlement)은 별도 테이블 없이 transactions.type='settlement' + category_id로 원 카테고리에 연결
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 1. households / household_members
-- ----------------------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default '우리집 가계부',
  invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  created_at timestamptz not null default now()
);
alter table public.households enable row level security;

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
alter table public.household_members enable row level security;

-- household 소속 여부 체크 헬퍼. security definer로 만들어서 이 함수 안의 조회는 RLS를 타지 않는다
-- (다른 테이블 RLS 정책 안에서 이 함수를 부를 때 재귀적으로 RLS가 얽히는 걸 방지하기 위함).
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from public.household_members hm
    where hm.household_id = hid and hm.user_id = auth.uid()
  );
$$;
grant execute on function public.is_household_member(uuid) to authenticated;

drop policy if exists households_select on public.households;
create policy households_select on public.households for select
  using (public.is_household_member(id));

drop policy if exists household_members_select on public.household_members;
create policy household_members_select on public.household_members for select
  using (user_id = auth.uid() or public.is_household_member(household_id));

-- household 생성/가입은 아래 create_household / join_household_by_code RPC로만 하도록 유도한다
-- (insert 직후 select 시점의 RLS 타이밍 문제를 피하고, 가입 시 개인용돈 envelope 자동 생성까지 한 번에 처리하기 위함).
-- 직접 insert가 필요한 경우에 대비해 최소한의 policy도 남겨둔다.
drop policy if exists households_insert on public.households;
create policy households_insert on public.households for insert
  with check (auth.uid() is not null);
drop policy if exists household_members_insert on public.household_members;
create policy household_members_insert on public.household_members for insert
  with check (user_id = auth.uid());

create or replace function public.create_household(p_name text default '우리집 가계부')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hh_id uuid;
begin
  if uid is null then
    raise exception 'create_household: 인증된 사용자만 호출 가능';
  end if;
  insert into public.households (name) values (p_name) returning id into hh_id;
  insert into public.household_members (household_id, user_id, role) values (hh_id, uid, 'owner');
  return hh_id;
end;
$$;
grant execute on function public.create_household(text) to authenticated;

create or replace function public.join_household_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hh_id uuid;
begin
  if uid is null then
    raise exception 'join_household_by_code: 인증된 사용자만 호출 가능';
  end if;

  select id into hh_id from public.households where invite_code = p_code;
  if hh_id is null then
    raise exception '초대 코드를 찾을 수 없어요';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (hh_id, uid, 'member')
  on conflict (household_id, user_id) do nothing;

  -- 이 사용자의 개인용돈 envelope가 아직 없으면 기본값으로 새로 만들어준다 (household와 무관하게 personal 소유).
  -- id는 'allowance' 같은 고정 문자열을 쓰면 안 된다 — irregular_envelopes.id는 테이블 전체에서 유일해야 하는
  -- primary key라, 다른 사용자가 이미 'allowance'를 쓰고 있으면 충돌한다. 사용자별로 유일하도록 uid를 섞는다.
  -- 존재 여부도 고정 id가 아니라 scope+name으로 판단한다.
  if not exists (select 1 from public.irregular_envelopes where user_id = uid and scope = 'personal' and name = '개인 용돈') then
    insert into public.irregular_envelopes (id, user_id, name, color, monthly_amount, start_month, subcats, sort_order, scope, household_id)
    values (
      'allowance_' || replace(uid::text, '-', ''), uid, '개인 용돈', '#B04338', 500000, to_char(current_date,'YYYY-MM'),
      array['꾸밈','문화·취미','의류','자동차','생활용품','여행','기타'],
      (select coalesce(max(sort_order),0)+1 from public.irregular_envelopes where user_id = uid),
      'personal', null
    );
  end if;

  return hh_id;
end;
$$;
grant execute on function public.join_household_by_code(text) to authenticated;


-- ----------------------------------------------------------------------------
-- STEP 2. income_categories: 정기수입 / 추가수입 (household 공유 템플릿)
-- ----------------------------------------------------------------------------
create table if not exists public.income_categories (
  id text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  color text,
  subcats text[] not null default '{}',
  sort_order int not null default 0
);
alter table public.income_categories enable row level security;
drop policy if exists income_categories_household on public.income_categories;
create policy income_categories_household on public.income_categories for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));


-- ----------------------------------------------------------------------------
-- STEP 3. envelope_bonus_credits: 보너스 등에서 개인용돈으로 1회성 적립 (이 달 적립액에 1회 가산, 누적 이력 X)
-- ----------------------------------------------------------------------------
create table if not exists public.envelope_bonus_credits (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  envelope_id text not null references public.irregular_envelopes(id) on delete cascade,
  month text not null,
  amount integer not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.envelope_bonus_credits enable row level security;


-- ----------------------------------------------------------------------------
-- STEP 4. 기존 테이블에 household_id / scope 컬럼 추가
-- ----------------------------------------------------------------------------
alter table public.living_categories add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.monthly_budgets   add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.transactions      add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.fixed_expenses    add column if not exists household_id uuid references public.households(id) on delete cascade;

alter table public.irregular_envelopes add column if not exists scope text not null default 'personal';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'irregular_envelopes_scope_check'
  ) then
    alter table public.irregular_envelopes add constraint irregular_envelopes_scope_check check (scope in ('household','personal'));
  end if;
end $$;
alter table public.irregular_envelopes add column if not exists household_id uuid references public.households(id) on delete cascade;


-- ----------------------------------------------------------------------------
-- STEP 5. Bootstrap: 기존 단일 사용자(urgan93@gmail.com) 데이터를 household로 편입
--   idempotent: 이미 household_members에 소속되어 있으면 기존 household를 재사용하고, 이미 채워진
--   household_id는 건드리지 않는다(where ... is null 조건으로 방지).
-- ----------------------------------------------------------------------------
do $$
declare
  the_uid uuid;
  hh_id uuid;
begin
  select id into the_uid from auth.users where email = 'urgan93@gmail.com' limit 1;
  if the_uid is null then
    raise notice 'urgan93@gmail.com 계정을 찾을 수 없어 household bootstrap을 건너뜁니다.';
    return;
  end if;

  select household_id into hh_id from public.household_members where user_id = the_uid limit 1;

  if hh_id is null then
    insert into public.households (name) values ('우리집 가계부') returning id into hh_id;
    insert into public.household_members (household_id, user_id, role) values (hh_id, the_uid, 'owner');
  end if;

  update public.living_categories set household_id = hh_id where user_id = the_uid and household_id is null;
  update public.monthly_budgets   set household_id = hh_id where user_id = the_uid and household_id is null;
  update public.fixed_expenses    set household_id = hh_id where user_id = the_uid and household_id is null;

  -- irregular envelopes: '경조사'로 개명된 것(과거 irregular1)은 household 공유, 그 외(개인용돈 등)는 personal 유지.
  -- user_id 컬럼이 NOT NULL이라 null로 지우지 않고 원래 소유자 값 그대로 둔다 (household-scope는 RLS에서
  -- user_id를 참조하지 않으니 값이 남아있어도 접근 제어에는 영향 없음).
  update public.irregular_envelopes
    set scope = 'household', household_id = hh_id
    where user_id = the_uid and name = '경조사';
  update public.irregular_envelopes
    set household_id = null
    where user_id = the_uid and scope = 'personal';

  -- 거래 household_id 백필: 생활 카테고리 또는 household-scope envelope(경조사)를 참조하는 거래만 공유로 표시.
  -- 개인용돈(scope='personal') 참조 거래는 household_id를 NULL로 유지해 배우자에게 노출되지 않게 한다.
  update public.transactions t
    set household_id = hh_id
    where t.user_id = the_uid and t.household_id is null
      and (
        t.category_id in (select id from public.living_categories where household_id = hh_id)
        or t.category_id in (select id from public.irregular_envelopes where household_id = hh_id and scope = 'household')
      );

  -- 수입 카테고리 템플릿 씨딩 (household당 1회)
  insert into public.income_categories (id, household_id, name, color, subcats, sort_order)
  select 'income_regular', hh_id, '정기수입', '#3E7A55', array['급여','교회페이'], 0
  where not exists (select 1 from public.income_categories where household_id = hh_id and id = 'income_regular');

  insert into public.income_categories (id, household_id, name, color, subcats, sort_order)
  select 'income_extra', hh_id, '추가수입', '#B98A2E', array['상여금','연주비','기타'], 1
  where not exists (select 1 from public.income_categories where household_id = hh_id and id = 'income_extra');
end $$;


-- ----------------------------------------------------------------------------
-- STEP 6. RLS 재설계 (household 기반으로 교체)
-- ----------------------------------------------------------------------------
drop policy if exists living_categories_owner_all on public.living_categories;
create policy living_categories_household on public.living_categories for all
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

drop policy if exists monthly_budgets_owner_all on public.monthly_budgets;
create policy monthly_budgets_household on public.monthly_budgets for all
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

drop policy if exists fixed_expenses_owner_all on public.fixed_expenses;
create policy fixed_expenses_household on public.fixed_expenses for all
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

-- transactions: 항상 내가 입력한 건 내가 보고, household_id가 세팅된(공유 카테고리) 거래는 같은 household원도 본다.
-- household_id가 NULL인(=개인 envelope) 거래는 user_id 본인만 접근 가능해서 배우자에게 절대 안 보인다.
drop policy if exists transactions_owner_all on public.transactions;
create policy transactions_access on public.transactions for all
  using (
    user_id = auth.uid()
    or (household_id is not null and public.is_household_member(household_id))
  )
  with check (
    user_id = auth.uid()
    or (household_id is not null and public.is_household_member(household_id))
  );

-- irregular_envelopes: scope에 따라 personal(user_id 본인) / household(구성원 전체) 분기
drop policy if exists irregular_envelopes_owner_all on public.irregular_envelopes;
create policy irregular_envelopes_access on public.irregular_envelopes for all
  using (
    (scope = 'personal' and user_id = auth.uid())
    or (scope = 'household' and household_id is not null and public.is_household_member(household_id))
  )
  with check (
    (scope = 'personal' and user_id = auth.uid())
    or (scope = 'household' and household_id is not null and public.is_household_member(household_id))
  );

-- envelope_rate_changes / envelope_bonus_credits: 참조하는 envelope의 접근권한을 그대로 물려받는다
drop policy if exists envelope_rate_changes_owner_all on public.envelope_rate_changes;
create policy envelope_rate_changes_access on public.envelope_rate_changes for all
  using (exists(
    select 1 from public.irregular_envelopes e
    where e.id = envelope_rate_changes.envelope_id
      and (
        (e.scope = 'personal' and e.user_id = auth.uid())
        or (e.scope = 'household' and e.household_id is not null and public.is_household_member(e.household_id))
      )
  ))
  with check (exists(
    select 1 from public.irregular_envelopes e
    where e.id = envelope_rate_changes.envelope_id
      and (
        (e.scope = 'personal' and e.user_id = auth.uid())
        or (e.scope = 'household' and e.household_id is not null and public.is_household_member(e.household_id))
      )
  ));

drop policy if exists envelope_bonus_credits_owner_all on public.envelope_bonus_credits;
create policy envelope_bonus_credits_access on public.envelope_bonus_credits for all
  using (exists(
    select 1 from public.irregular_envelopes e
    where e.id = envelope_bonus_credits.envelope_id
      and (
        (e.scope = 'personal' and e.user_id = auth.uid())
        or (e.scope = 'household' and e.household_id is not null and public.is_household_member(e.household_id))
      )
  ))
  with check (exists(
    select 1 from public.irregular_envelopes e
    where e.id = envelope_bonus_credits.envelope_id
      and (
        (e.scope = 'personal' and e.user_id = auth.uid())
        or (e.scope = 'household' and e.household_id is not null and public.is_household_member(e.household_id))
      )
  ));

-- pay_methods는 그대로 개인(user_id) 소유 유지 (카드/계좌는 각자 소유한다고 가정)
