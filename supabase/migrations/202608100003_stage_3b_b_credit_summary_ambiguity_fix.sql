-- Stage 3B-B hotfix
-- Fix ambiguous column reference in get_agency_credit_summary.

begin;

create or replace function public.get_agency_credit_summary(
  p_agency_id uuid
)
returns table(
  agency_id uuid,
  approved_credit_limit_cents bigint,
  ledger_exposure_cents bigint,
  active_hold_exposure_cents bigint,
  pending_exception_cents bigint,
  current_exposure_cents bigint,
  available_credit_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit bigint;
  v_ledger bigint;
  v_active_holds bigint;
  v_pending bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not (
       public.session_is_aal2()
       and (
         public.is_active_agency_member(p_agency_id)
         or public.is_active_staff(null)
       )
     ) then
    raise exception 'Agency credit access is not authorized.';
  end if;

  select account.approved_credit_limit_cents
  into v_limit
  from public.agency_accounts account
  where account.id = p_agency_id;

  if v_limit is null then
    raise exception 'Agency account not found.';
  end if;

  select greatest(coalesce(sum(amount_cents), 0), 0)
  into v_ledger
  from public.agency_credit_ledger
  where agency_id = p_agency_id;

  select coalesce(sum(amount_cents), 0)
  into v_active_holds
  from public.agency_credit_holds
  where agency_id = p_agency_id
    and status in ('active', 'approved_exception')
    and (held_until is null or held_until > timezone('utc', now()));

  select coalesce(sum(amount_cents), 0)
  into v_pending
  from public.agency_credit_holds
  where agency_id = p_agency_id
    and status = 'pending_exception'
    and (held_until is null or held_until > timezone('utc', now()));

  return query
  select
    p_agency_id,
    v_limit,
    v_ledger,
    v_active_holds,
    v_pending,
    v_ledger + v_active_holds,
    greatest(v_limit - v_ledger - v_active_holds, 0);
end;
$$;

grant execute on function public.get_agency_credit_summary(uuid) to authenticated;
grant execute on function public.get_agency_credit_summary(uuid) to service_role;

commit;
