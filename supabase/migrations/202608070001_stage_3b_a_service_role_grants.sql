-- La Grandiosa Stage 3B-A
-- Service-role Data API grants
--
-- Why this is needed:
-- New Supabase projects may not automatically expose newly created public
-- tables to the Data API. RLS bypass alone is not enough; the service_role
-- must also have explicit PostgreSQL privileges on these tables.

begin;

grant usage on schema public to service_role;

grant select, insert, update, delete
on table
  public.user_profiles,
  public.agency_accounts,
  public.agency_members,
  public.staff_members,
  public.agency_invites,
  public.agency_account_history
to service_role;

grant usage, select
on sequence public.agency_account_number_seq
to service_role;

grant execute
on function public.next_agency_account_number()
to service_role;

grant execute
on function public.bootstrap_staff_member(
  text,
  text,
  text,
  public.staff_role
)
to service_role;

commit;

-- Verification: this should return privilege rows for all six Stage 3B-A tables.
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'service_role'
  and table_name in (
    'user_profiles',
    'agency_accounts',
    'agency_members',
    'staff_members',
    'agency_invites',
    'agency_account_history'
  )
order by table_name, privilege_type;
