create table if not exists public.access_leads (
  id uuid primary key default gen_random_uuid(),
  requester_name text,
  requester_email text not null,
  company_name text,
  message text,
  source text not null default 'homepage_access_request',
  status text not null default 'new' check (status in ('new','contacted','qualified','closed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists access_leads_email_lower_idx
  on public.access_leads (lower(requester_email));
create index if not exists access_leads_status_idx
  on public.access_leads (status);
create index if not exists access_leads_created_at_idx
  on public.access_leads (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists access_leads_set_updated_at on public.access_leads;
create trigger access_leads_set_updated_at
before update on public.access_leads
for each row
execute function public.set_updated_at();

alter table public.access_leads enable row level security;
revoke all on table public.access_leads from anon, authenticated;
grant select, insert, update on table public.access_leads to authenticated;
grant all on table public.access_leads to service_role;

create policy access_leads_insert_any_authenticated
on public.access_leads
for insert
to authenticated
with check (true);

create policy access_leads_select_staff_or_owner
on public.access_leads
for select
to authenticated
using (
  public.session_is_aal2()
  and (
    public.is_active_staff(null)
    or lower(requester_email) = lower(auth.jwt() ->> 'email')
  )
);

create policy access_leads_update_staff
on public.access_leads
for update
to authenticated
using (public.session_is_aal2() and public.is_active_staff(null))
with check (public.session_is_aal2() and public.is_active_staff(null));
