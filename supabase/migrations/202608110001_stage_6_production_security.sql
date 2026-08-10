-- La Grandiosa Commerce — Stage 6
-- Production security, rate limiting, launch certification, and audit records.

begin;

create extension if not exists pgcrypto;

do $$
begin
  create type public.security_event_severity as enum (
    'info',
    'warning',
    'critical'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.launch_check_status as enum (
    'pending',
    'passed',
    'waived',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.release_signoff_status as enum (
    'draft',
    'approved',
    'revoked'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default timezone('utc', now()),
  event_key text not null,
  severity public.security_event_severity not null default 'info',
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  route text,
  request_method text,
  request_ip_hash text,
  user_agent text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists security_events_occurred_idx
  on public.security_events (occurred_at desc);
create index if not exists security_events_key_idx
  on public.security_events (event_key, occurred_at desc);
create index if not exists security_events_actor_idx
  on public.security_events (actor_user_id, occurred_at desc);
create index if not exists security_events_severity_idx
  on public.security_events (severity, occurred_at desc);

create table if not exists public.rate_limit_buckets (
  key_hash text primary key,
  scope text not null,
  window_started_at timestamptz not null,
  window_seconds integer not null check (window_seconds between 1 and 86400),
  hit_count integer not null default 0 check (hit_count >= 0),
  blocked_count integer not null default 0 check (blocked_count >= 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists rate_limit_buckets_expires_idx
  on public.rate_limit_buckets (expires_at);

create table if not exists public.security_audit_snapshots (
  id uuid primary key default gen_random_uuid(),
  generated_at timestamptz not null default timezone('utc', now()),
  generated_by_user_id uuid references auth.users(id) on delete set null,
  report jsonb not null,
  notes text
);

create index if not exists security_audit_snapshots_generated_idx
  on public.security_audit_snapshots (generated_at desc);

create table if not exists public.launch_checklist_items (
  id text primary key,
  category text not null,
  label text not null,
  description text not null,
  required boolean not null default true,
  status public.launch_check_status not null default 'pending',
  evidence text,
  sort_order integer not null default 0,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists launch_checklist_category_idx
  on public.launch_checklist_items (category, sort_order);

drop trigger if exists launch_checklist_items_set_updated_at
  on public.launch_checklist_items;
create trigger launch_checklist_items_set_updated_at
before update on public.launch_checklist_items
for each row execute function public.set_updated_at();

create table if not exists public.production_release_signoffs (
  id uuid primary key default gen_random_uuid(),
  release_name text not null,
  git_commit text,
  deployment_url text,
  status public.release_signoff_status not null default 'approved',
  notes text,
  signed_by_user_id uuid not null references auth.users(id),
  signed_at timestamptz not null default timezone('utc', now()),
  revoked_by_user_id uuid references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists production_release_signoffs_signed_idx
  on public.production_release_signoffs (signed_at desc);

insert into public.launch_checklist_items (
  id,
  category,
  label,
  description,
  required,
  sort_order
)
values
  ('infra-vercel-domain', 'Infrastructure', 'Production domain and HTTPS',
   'Confirm www.lagrandiosapr.com resolves to the production deployment and HTTPS is valid.', true, 10),
  ('infra-vercel-env', 'Infrastructure', 'Vercel production environment variables',
   'Confirm all required Supabase, communications, cron, and security variables are present in Vercel Production.', true, 20),
  ('infra-preview-env', 'Infrastructure', 'Preview environment isolation',
   'Confirm Preview uses non-production credentials or an approved isolated Supabase environment.', true, 30),
  ('infra-cron', 'Infrastructure', 'Production automation schedule',
   'Confirm notification and reminder automation is configured with CRON_SECRET.', true, 40),
  ('auth-public-signup', 'Authentication', 'Public signup disabled',
   'Confirm Supabase public registration is disabled and agency users are invite-only.', true, 50),
  ('auth-staff-mfa', 'Authentication', 'Staff MFA verified',
   'Confirm every active staff user has a verified authenticator factor.', true, 60),
  ('auth-buyers-mfa', 'Authentication', 'Agency buyer MFA verified',
   'Confirm every active purchasing user has a verified authenticator factor.', true, 70),
  ('auth-role-test', 'Authentication', 'Role access matrix tested',
   'Test agency_buyer, agency_admin, sales_reviewer, finance, and system_admin access boundaries.', true, 80),
  ('database-rls', 'Database', 'RLS enabled on critical tables',
   'Confirm Row Level Security is enabled on every private commerce table.', true, 90),
  ('database-grants', 'Database', 'Anonymous grants audit',
   'Confirm anon has no direct privileges on private commerce tables.', true, 100),
  ('database-backup', 'Database', 'Backup policy confirmed',
   'Confirm the Supabase backup or PITR plan and retention appropriate for production.', true, 110),
  ('database-restore', 'Database', 'Restore procedure tested',
   'Document and test a non-production database recovery procedure.', true, 120),
  ('storage-private', 'Storage', 'All operational buckets private',
   'Confirm purchase-orders and campaign-assets buckets are private.', true, 130),
  ('storage-upload', 'Storage', 'Upload security tested',
   'Test signed upload expiration, file limits, MIME validation, and cross-agency access denial.', true, 140),
  ('communications-email', 'Communications', 'Transactional email delivery',
   'Verify orders@lagrandiosapr.com, reply-to, webhook delivery, bounce handling, and suppression.', true, 150),
  ('communications-sms', 'Communications', 'Transactional SMS delivery or waiver',
   'Verify Twilio delivery and consent handling, or formally waive SMS for initial launch.', false, 160),
  ('communications-retry', 'Communications', 'Retries and dead-letter handling',
   'Test notification retry, cancellation, suppression, and dead-letter workflows.', true, 170),
  ('finance-remittance', 'Finance', 'Bank remittance verified',
   'Confirm secure remittance details, invoice PDF output, and fraud-warning language.', true, 180),
  ('finance-tax', 'Finance', 'Tax treatment approved',
   'Confirm invoice tax treatment with the company accountant before production invoicing.', true, 190),
  ('legal-contract', 'Legal', 'Contract and PO terms approved',
   'Confirm contract, cancellation, credit, invoice, privacy, and asset terms are legally approved.', true, 200),
  ('workflow-e2e', 'Quality Assurance', 'End-to-end agency order test',
   'Complete login, MFA, order, pricing, credit, PO, invoice, upload, review, and release tests.', true, 210),
  ('workflow-mobile', 'Quality Assurance', 'Mobile and browser QA',
   'Test current Safari, Chrome, Edge, iOS, and Android at supported screen sizes.', true, 220),
  ('workflow-performance', 'Quality Assurance', 'Production performance review',
   'Review production page speed, large-file upload reliability, and server-route latency.', true, 230),
  ('security-secret-scan', 'Security', 'Repository secret scan',
   'Confirm no production API keys, bank data, auth tokens, or personal secrets are tracked by Git.', true, 240),
  ('security-rate-limits', 'Security', 'Rate-limit verification',
   'Test login, order-creation, PO upload, and asset-upload throttling.', true, 250),
  ('security-headers', 'Security', 'Security headers verified',
   'Confirm CSP, HSTS, frame protection, referrer policy, and private-route no-store behavior.', true, 260),
  ('security-incident', 'Security', 'Incident response contacts',
   'Confirm incident owners, escalation contacts, credential rotation, and client communication procedures.', true, 270),
  ('operations-runbook', 'Operations', 'Operations manual approved',
   'Confirm daily processing, finance, asset-review, release, and notification procedures.', true, 280),
  ('led-manual-release', 'LED Delivery', 'Manual release procedure',
   'Approve the manual release and verification process until the LED provider API is connected.', true, 290),
  ('launch-smoke', 'Launch', 'Production smoke test',
   'Complete production health, sign-in, protected-route, order, upload, and notification smoke tests.', true, 300)
on conflict (id) do nothing;

create or replace function public.consume_rate_limit(
  p_key_hash text,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns table(
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  current_hits integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_started timestamptz;
  v_hits integer;
  v_reset timestamptz;
  v_allowed boolean;
begin
  if trim(coalesce(p_key_hash, '')) = '' then
    raise exception 'Rate-limit key is required.';
  end if;

  if trim(coalesce(p_scope, '')) = '' then
    raise exception 'Rate-limit scope is required.';
  end if;

  if p_limit < 1 or p_limit > 10000 then
    raise exception 'Rate-limit threshold is invalid.';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Rate-limit window is invalid.';
  end if;

  insert into public.rate_limit_buckets (
    key_hash,
    scope,
    window_started_at,
    window_seconds,
    hit_count,
    blocked_count,
    expires_at,
    updated_at
  )
  values (
    p_key_hash,
    p_scope,
    v_now,
    p_window_seconds,
    0,
    0,
    v_now + make_interval(secs => p_window_seconds),
    v_now
  )
  on conflict (key_hash) do nothing;

  select window_started_at, hit_count
  into v_started, v_hits
  from public.rate_limit_buckets
  where key_hash = p_key_hash
  for update;

  if v_started + make_interval(secs => p_window_seconds) <= v_now then
    v_started := v_now;
    v_hits := 1;

    update public.rate_limit_buckets
    set
      scope = p_scope,
      window_started_at = v_started,
      window_seconds = p_window_seconds,
      hit_count = v_hits,
      blocked_count = 0,
      expires_at = v_started + make_interval(secs => p_window_seconds),
      updated_at = v_now
    where key_hash = p_key_hash;
  else
    v_hits := v_hits + 1;

    update public.rate_limit_buckets
    set
      scope = p_scope,
      window_seconds = p_window_seconds,
      hit_count = v_hits,
      expires_at = v_started + make_interval(secs => p_window_seconds),
      updated_at = v_now
    where key_hash = p_key_hash;
  end if;

  v_allowed := v_hits <= p_limit;
  v_reset := v_started + make_interval(secs => p_window_seconds);

  if not v_allowed then
    update public.rate_limit_buckets
    set blocked_count = blocked_count + 1
    where key_hash = p_key_hash;
  end if;

  return query
  select
    v_allowed,
    greatest(p_limit - v_hits, 0),
    v_reset,
    v_hits;
end;
$$;

create or replace function public.purge_expired_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.rate_limit_buckets
  where expires_at < timezone('utc', now()) - interval '1 day';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.record_security_event(
  p_event_key text,
  p_severity public.security_event_severity,
  p_actor_user_id uuid,
  p_actor_email text,
  p_route text,
  p_request_method text,
  p_request_ip_hash text,
  p_user_agent text,
  p_request_id text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.security_events (
    event_key,
    severity,
    actor_user_id,
    actor_email,
    route,
    request_method,
    request_ip_hash,
    user_agent,
    request_id,
    metadata
  )
  values (
    trim(p_event_key),
    coalesce(p_severity, 'info'),
    p_actor_user_id,
    nullif(lower(trim(p_actor_email)), ''),
    nullif(trim(p_route), ''),
    nullif(upper(trim(p_request_method)), ''),
    nullif(trim(p_request_ip_hash), ''),
    nullif(left(trim(p_user_agent), 1000), ''),
    nullif(trim(p_request_id), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_stage_6_security_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, storage
as $$
declare
  v_critical_tables text[] := array[
    'client_contacts',
    'orders',
    'order_items',
    'order_status_history',
    'audit_log',
    'notification_outbox',
    'inventory_holds',
    'user_profiles',
    'agency_accounts',
    'agency_members',
    'staff_members',
    'agency_invites',
    'agency_account_history',
    'agency_credit_holds',
    'agency_credit_reviews',
    'agency_credit_ledger',
    'purchase_orders',
    'purchase_order_documents',
    'invoices',
    'invoice_items',
    'invoice_payments',
    'invoice_status_history',
    'remittance_accounts',
    'asset_specifications',
    'order_asset_slots',
    'asset_files',
    'asset_submissions',
    'asset_submission_items',
    'asset_release_queue',
    'notification_provider_events',
    'notification_suppressions',
    'automation_job_locks',
    'security_events',
    'rate_limit_buckets',
    'security_audit_snapshots',
    'launch_checklist_items',
    'production_release_signoffs'
  ];
  v_rls_missing jsonb;
  v_anon_grants jsonb;
  v_public_buckets jsonb;
  v_staff_without_mfa integer;
  v_buyers_without_mfa integer;
  v_expired_invites integer;
  v_dead_letters integer;
  v_failed_releases integer;
  v_required_pending integer;
  v_active_remittance integer;
  v_overdue_invoices integer;
begin
  select coalesce(
    jsonb_agg(c.relname order by c.relname),
    '[]'::jsonb
  )
  into v_rls_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname::text = any(v_critical_tables)
    and not c.relrowsecurity;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', grants.table_name,
        'privilege', grants.privilege_type
      )
      order by grants.table_name, grants.privilege_type
    ),
    '[]'::jsonb
  )
  into v_anon_grants
  from information_schema.role_table_grants grants
  where grants.table_schema = 'public'
    and grants.grantee = 'anon'
    and grants.table_name = any(v_critical_tables);

  select coalesce(jsonb_agg(bucket.id order by bucket.id), '[]'::jsonb)
  into v_public_buckets
  from storage.buckets bucket
  where bucket.public = true;

  select count(*)::integer
  into v_staff_without_mfa
  from public.staff_members staff
  join public.user_profiles profile on profile.user_id = staff.user_id
  where staff.active = true
    and profile.status = 'active'
    and not exists (
      select 1
      from auth.mfa_factors factor
      where factor.user_id = staff.user_id
        and factor.status = 'verified'
    );

  select count(*)::integer
  into v_buyers_without_mfa
  from public.agency_members member
  join public.user_profiles profile on profile.user_id = member.user_id
  join public.agency_accounts agency on agency.id = member.agency_id
  where member.status = 'active'
    and member.can_purchase = true
    and profile.status = 'active'
    and agency.status = 'active'
    and not exists (
      select 1
      from auth.mfa_factors factor
      where factor.user_id = member.user_id
        and factor.status = 'verified'
    );

  select count(*)::integer
  into v_expired_invites
  from public.agency_invites invite
  where invite.status = 'pending'
    and invite.expires_at < timezone('utc', now());

  select count(*)::integer
  into v_dead_letters
  from public.notification_outbox notification
  where notification.status = 'dead_letter';

  select count(*)::integer
  into v_failed_releases
  from public.asset_release_queue release
  where release.status = 'failed';

  select count(*)::integer
  into v_required_pending
  from public.launch_checklist_items item
  where item.required = true
    and item.status not in ('passed', 'waived');

  select count(*)::integer
  into v_active_remittance
  from public.remittance_accounts account
  where account.active = true;

  select count(*)::integer
  into v_overdue_invoices
  from public.invoices invoice
  where invoice.balance_cents > 0
    and invoice.due_date < current_date
    and invoice.status not in ('paid', 'void', 'written_off');

  return jsonb_build_object(
    'generatedAt', timezone('utc', now()),
    'rlsMissing', v_rls_missing,
    'anonGrants', v_anon_grants,
    'publicBuckets', v_public_buckets,
    'activeStaffWithoutVerifiedMfa', v_staff_without_mfa,
    'activeBuyersWithoutVerifiedMfa', v_buyers_without_mfa,
    'expiredPendingInvites', v_expired_invites,
    'deadLetterNotifications', v_dead_letters,
    'failedReleaseQueueItems', v_failed_releases,
    'requiredLaunchChecksOpen', v_required_pending,
    'activeRemittanceAccounts', v_active_remittance,
    'overdueInvoices', v_overdue_invoices
  );
end;
$$;

create or replace function public.save_security_audit_snapshot(
  p_actor_user_id uuid,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.security_audit_snapshots (
    generated_by_user_id,
    report,
    notes
  )
  values (
    p_actor_user_id,
    public.get_stage_6_security_report(),
    nullif(trim(p_notes), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_launch_checklist_item(
  p_item_id text,
  p_status public.launch_check_status,
  p_evidence text,
  p_actor_user_id uuid
)
returns public.launch_checklist_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.launch_checklist_items%rowtype;
begin
  update public.launch_checklist_items
  set
    status = p_status,
    evidence = nullif(trim(p_evidence), ''),
    reviewed_by_user_id = p_actor_user_id,
    reviewed_at = timezone('utc', now())
  where id = p_item_id
  returning * into v_item;

  if not found then
    raise exception 'Launch checklist item not found.';
  end if;

  return v_item;
end;
$$;

create or replace function public.create_production_release_signoff(
  p_release_name text,
  p_git_commit text,
  p_deployment_url text,
  p_notes text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open_required integer;
  v_id uuid;
begin
  select count(*)::integer
  into v_open_required
  from public.launch_checklist_items
  where required = true
    and status not in ('passed', 'waived');

  if v_open_required > 0 then
    raise exception
      'Production signoff is blocked by % required launch checklist item(s).',
      v_open_required;
  end if;

  if trim(coalesce(p_release_name, '')) = '' then
    raise exception 'Release name is required.';
  end if;

  insert into public.production_release_signoffs (
    release_name,
    git_commit,
    deployment_url,
    status,
    notes,
    signed_by_user_id
  )
  values (
    trim(p_release_name),
    nullif(trim(p_git_commit), ''),
    nullif(trim(p_deployment_url), ''),
    'approved',
    nullif(trim(p_notes), ''),
    p_actor_user_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

alter table public.security_events enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.security_audit_snapshots enable row level security;
alter table public.launch_checklist_items enable row level security;
alter table public.production_release_signoffs enable row level security;

revoke all on table public.security_events from anon, authenticated;
revoke all on table public.rate_limit_buckets from anon, authenticated;
revoke all on table public.security_audit_snapshots from anon, authenticated;
revoke all on table public.launch_checklist_items from anon, authenticated;
revoke all on table public.production_release_signoffs from anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.security_events to service_role;
grant all on table public.rate_limit_buckets to service_role;
grant all on table public.security_audit_snapshots to service_role;
grant all on table public.launch_checklist_items to service_role;
grant all on table public.production_release_signoffs to service_role;

revoke all on function public.consume_rate_limit(text,text,integer,integer)
  from public, anon, authenticated;
revoke all on function public.purge_expired_rate_limits()
  from public, anon, authenticated;
revoke all on function public.record_security_event(
  text,public.security_event_severity,uuid,text,text,text,text,text,text,jsonb
) from public, anon, authenticated;
revoke all on function public.get_stage_6_security_report()
  from public, anon, authenticated;
revoke all on function public.save_security_audit_snapshot(uuid,text)
  from public, anon, authenticated;
revoke all on function public.update_launch_checklist_item(
  text,public.launch_check_status,text,uuid
) from public, anon, authenticated;
revoke all on function public.create_production_release_signoff(
  text,text,text,text,uuid
) from public, anon, authenticated;

grant execute on function public.consume_rate_limit(text,text,integer,integer)
  to service_role;
grant execute on function public.purge_expired_rate_limits()
  to service_role;
grant execute on function public.record_security_event(
  text,public.security_event_severity,uuid,text,text,text,text,text,text,jsonb
) to service_role;
grant execute on function public.get_stage_6_security_report()
  to service_role;
grant execute on function public.save_security_audit_snapshot(uuid,text)
  to service_role;
grant execute on function public.update_launch_checklist_item(
  text,public.launch_check_status,text,uuid
) to service_role;
grant execute on function public.create_production_release_signoff(
  text,text,text,text,uuid
) to service_role;

commit;
