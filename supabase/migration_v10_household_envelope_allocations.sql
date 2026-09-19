-- 누적 카테고리의 정기 충전액만 가구 구성원에게 공유한다.
-- Supabase SQL Editor에서 실행. 기존 항목/거래/잔액은 변경하지 않는다.
-- 개인 지출, 추가 적립, 잔액의 RLS는 그대로 유지한다.
create or replace function public.household_envelope_allocations(p_household_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_household_member(p_household_id) then
    raise exception '가계부 구성원만 조회할 수 있습니다' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'name', e.name, 'userId', e.user_id, 'scope', e.scope,
      'startMonth', e.start_month, 'monthlyAmount', e.monthly_amount,
      'rateChanges', coalesce((
        select jsonb_agg(jsonb_build_object('envelopeId', r.envelope_id,
          'effectiveMonth', r.effective_month, 'amount', r.monthly_amount))
        from public.envelope_rate_changes r where r.envelope_id = e.id
      ), '[]'::jsonb)
    ) order by e.sort_order, e.id)
    from public.irregular_envelopes e
    where (e.scope = 'household' and e.household_id = p_household_id)
       or (e.scope = 'personal' and exists (
         select 1 from public.household_members m
         where m.household_id = p_household_id and m.user_id = e.user_id
       ))
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.household_envelope_allocations(uuid) from public, anon;
grant execute on function public.household_envelope_allocations(uuid) to authenticated;
