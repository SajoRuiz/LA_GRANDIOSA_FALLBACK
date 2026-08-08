-- La Grandiosa Commerce — Stage 5
-- Live transactional communications, provider events, reminder automation,
-- notification retries/dead-letter handling, and asset-deadline management.

-- PostgreSQL requires a newly added enum value to be committed before it can
-- be referenced in functions or constraints created later in the migration.
alter type public.notification_status add value if not exists 'dead_letter';

begin;

-- ------------------------------------------------------------------
-- Asset deadlines
-- ------------------------------------------------------------------
alter table public.orders
  add column if not exists asset_due_at timestamptz,
  add column if not exists asset_due_set_by_user_id uuid references auth.users(id),
  add column if not exists asset_due_note text;

create index if not exists orders_asset_due_idx
  on public.orders (asset_due_at, status)
  where asset_due_at is not null;

-- ------------------------------------------------------------------
-- Notification reliability and provider-event history
-- ------------------------------------------------------------------
alter table public.notification_outbox
  add column if not exists category text not null default 'transactional',
  add column if not exists priority integer not null default 100,
  add column if not exists max_attempts integer not null default 6,
  add column if not exists processing_started_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists provider_event_count integer not null default 0;

alter table public.notification_outbox
  drop constraint if exists notification_outbox_max_attempts_check;
alter table public.notification_outbox
  add constraint notification_outbox_max_attempts_check
  check (max_attempts between 1 and 20);

alter table public.notification_outbox
  drop constraint if exists notification_outbox_priority_check;
alter table public.notification_outbox
  add constraint notification_outbox_priority_check
  check (priority between 0 and 1000);

create index if not exists notification_outbox_claim_v5_idx
  on public.notification_outbox (
    status,
    next_attempt_at,
    priority,
    created_at
  );

create table if not exists public.notification_provider_events (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notification_outbox(id) on delete set null,
  provider text not null,
  provider_event_id text not null,
  provider_message_id text,
  event_type text not null,
  error_code text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz,
  received_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_event_id)
);

create index if not exists notification_provider_events_notification_idx
  on public.notification_provider_events (notification_id, received_at desc);
create index if not exists notification_provider_events_message_idx
  on public.notification_provider_events (provider, provider_message_id)
  where provider_message_id is not null;

create table if not exists public.notification_suppressions (
  id uuid primary key default gen_random_uuid(),
  channel public.notification_channel not null,
  recipient text not null,
  reason text not null,
  source text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists notification_suppressions_active_recipient_idx
  on public.notification_suppressions (channel, lower(recipient))
  where active = true;

create table if not exists public.automation_job_locks (
  job_key text primary key,
  lock_token uuid not null,
  locked_until timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now())
);

-- ------------------------------------------------------------------
-- Atomic worker functions
-- ------------------------------------------------------------------
create or replace function public.claim_notification_batch(
  p_limit integer default 20
)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select outbox.id
    from public.notification_outbox outbox
    where (
      (
        outbox.status in ('queued', 'failed')
        and outbox.next_attempt_at <= timezone('utc', now())
      )
      or (
        outbox.status = 'processing'
        and outbox.processing_started_at < timezone('utc', now()) - interval '15 minutes'
      )
    )
      and outbox.attempts < outbox.max_attempts
      and not exists (
        select 1
        from public.notification_suppressions suppression
        where suppression.active = true
          and suppression.channel = outbox.channel
          and lower(suppression.recipient) = lower(outbox.recipient)
      )
    order by outbox.priority asc, outbox.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.notification_outbox outbox
  set
    status = 'processing',
    attempts = outbox.attempts + 1,
    processing_started_at = timezone('utc', now()),
    last_attempt_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  from candidates
  where outbox.id = candidates.id
  returning outbox.*;
end;
$$;

create or replace function public.defer_notification(
  p_notification_id uuid,
  p_reason text,
  p_retry_after_seconds integer default 3600
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_outbox
  set
    status = 'queued',
    attempts = greatest(attempts - 1, 0),
    processing_started_at = null,
    last_error = left(coalesce(p_reason, 'Notification deferred.'), 2000),
    next_attempt_at = timezone('utc', now())
      + make_interval(secs => greatest(60, coalesce(p_retry_after_seconds, 3600))),
    updated_at = timezone('utc', now())
  where id = p_notification_id;
end;
$$;

create or replace function public.mark_notification_sent(
  p_notification_id uuid,
  p_provider text,
  p_provider_message_id text,
  p_provider_status text,
  p_provider_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_outbox
  set
    status = 'sent',
    provider = p_provider,
    provider_message_id = nullif(trim(p_provider_message_id), ''),
    provider_status = nullif(trim(p_provider_status), ''),
    provider_payload = coalesce(p_provider_payload, '{}'::jsonb),
    processing_started_at = null,
    last_error = null,
    sent_at = coalesce(sent_at, timezone('utc', now())),
    delivered_at = case
      when p_provider_status = 'delivered'
        then coalesce(delivered_at, timezone('utc', now()))
      else delivered_at
    end,
    updated_at = timezone('utc', now())
  where id = p_notification_id;
end;
$$;

create or replace function public.mark_notification_failed(
  p_notification_id uuid,
  p_error text,
  p_retry_after_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
  v_max_attempts integer;
  v_retry_seconds integer;
  v_status public.notification_status;
begin
  select attempts, max_attempts
  into v_attempts, v_max_attempts
  from public.notification_outbox
  where id = p_notification_id
  for update;

  if not found then
    return;
  end if;

  if v_attempts >= v_max_attempts then
    v_status := 'dead_letter';
    v_retry_seconds := 0;
  else
    v_status := 'failed';
    v_retry_seconds := least(
      21600,
      greatest(
        60,
        coalesce(
          p_retry_after_seconds,
          round(60 * power(2, greatest(v_attempts - 1, 0)))::integer
        )
      )
    );
  end if;

  update public.notification_outbox
  set
    status = v_status,
    processing_started_at = null,
    last_error = left(coalesce(p_error, 'Unknown delivery error'), 2000),
    next_attempt_at = case
      when v_status = 'dead_letter' then timezone('utc', now())
      else timezone('utc', now()) + make_interval(secs => v_retry_seconds)
    end,
    updated_at = timezone('utc', now())
  where id = p_notification_id;
end;
$$;

create or replace function public.retry_notification(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_outbox
  set
    status = 'queued',
    attempts = 0,
    next_attempt_at = timezone('utc', now()),
    processing_started_at = null,
    cancelled_at = null,
    last_error = null,
    updated_at = timezone('utc', now())
  where id = p_notification_id
    and status in ('failed', 'dead_letter', 'cancelled');
end;
$$;

create or replace function public.cancel_notification(
  p_notification_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_outbox
  set
    status = 'cancelled',
    processing_started_at = null,
    cancelled_at = timezone('utc', now()),
    last_error = left(coalesce(nullif(trim(p_reason), ''), 'Cancelled by an administrator.'), 2000),
    updated_at = timezone('utc', now())
  where id = p_notification_id
    and status not in ('sent', 'cancelled');
end;
$$;

create or replace function public.record_notification_provider_event(
  p_provider text,
  p_provider_event_id text,
  p_provider_message_id text,
  p_event_type text,
  p_error_code text,
  p_payload jsonb,
  p_occurred_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification public.notification_outbox%rowtype;
  v_inserted integer;
begin
  select *
  into v_notification
  from public.notification_outbox
  where provider = p_provider
    and provider_message_id = p_provider_message_id
  order by sent_at desc nulls last
  limit 1;

  insert into public.notification_provider_events (
    notification_id,
    provider,
    provider_event_id,
    provider_message_id,
    event_type,
    error_code,
    payload,
    occurred_at
  )
  values (
    v_notification.id,
    p_provider,
    p_provider_event_id,
    nullif(trim(p_provider_message_id), ''),
    p_event_type,
    nullif(trim(p_error_code), ''),
    coalesce(p_payload, '{}'::jsonb),
    p_occurred_at
  )
  on conflict (provider, provider_event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  if v_notification.id is null then
    return true;
  end if;

  update public.notification_outbox
  set
    provider_status = p_event_type,
    provider_payload = coalesce(p_payload, '{}'::jsonb),
    provider_event_count = provider_event_count + 1,
    delivered_at = case
      when p_event_type in ('email.delivered', 'delivered')
        then coalesce(delivered_at, timezone('utc', now()))
      else delivered_at
    end,
    status = case
      when p_event_type in (
        'email.bounced',
        'email.complained',
        'email.failed',
        'email.suppressed',
        'failed',
        'undelivered'
      ) then 'dead_letter'::public.notification_status
      else status
    end,
    last_error = case
      when p_event_type in (
        'email.bounced',
        'email.complained',
        'email.failed',
        'email.suppressed',
        'failed',
        'undelivered'
      ) then left(coalesce(nullif(trim(p_error_code), ''), p_event_type), 2000)
      else last_error
    end,
    updated_at = timezone('utc', now())
  where id = v_notification.id;

  if p_provider = 'resend'
     and p_event_type in ('email.bounced', 'email.complained', 'email.suppressed')
     and v_notification.recipient is not null
     and not exists (
       select 1
       from public.notification_suppressions suppression
       where suppression.active = true
         and suppression.channel = 'email'
         and lower(suppression.recipient) = lower(v_notification.recipient)
     ) then
    insert into public.notification_suppressions (
      channel,
      recipient,
      reason,
      source,
      metadata
    )
    values (
      'email',
      lower(v_notification.recipient),
      p_event_type,
      'resend_webhook',
      jsonb_build_object(
        'providerMessageId', p_provider_message_id,
        'providerEventId', p_provider_event_id
      )
    );
  end if;

  return true;
end;
$$;

create or replace function public.acquire_automation_lock(
  p_job_key text,
  p_lock_token uuid,
  p_ttl_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acquired boolean := false;
begin
  insert into public.automation_job_locks (
    job_key,
    lock_token,
    locked_until,
    updated_at
  )
  values (
    p_job_key,
    p_lock_token,
    timezone('utc', now()) + make_interval(secs => greatest(30, p_ttl_seconds)),
    timezone('utc', now())
  )
  on conflict (job_key) do update
  set
    lock_token = excluded.lock_token,
    locked_until = excluded.locked_until,
    updated_at = excluded.updated_at
  where public.automation_job_locks.locked_until <= timezone('utc', now())
     or public.automation_job_locks.lock_token = excluded.lock_token;

  select exists (
    select 1
    from public.automation_job_locks
    where job_key = p_job_key
      and lock_token = p_lock_token
      and locked_until > timezone('utc', now())
  ) into v_acquired;

  return v_acquired;
end;
$$;

create or replace function public.release_automation_lock(
  p_job_key text,
  p_lock_token uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.automation_job_locks
  where job_key = p_job_key
    and lock_token = p_lock_token;
$$;

create or replace function public.set_order_asset_deadline(
  p_order_id uuid,
  p_due_at timestamptz,
  p_note text,
  p_actor_user_id uuid
)
returns table(
  order_id uuid,
  order_number text,
  asset_due_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if p_due_at is not null
     and p_due_at <= timezone('utc', now()) - interval '1 day' then
    raise exception 'Asset deadline cannot be set in the distant past.';
  end if;

  update public.orders
  set
    asset_due_at = p_due_at,
    asset_due_set_by_user_id = p_actor_user_id,
    asset_due_note = nullif(trim(p_note), '')
  where id = p_order_id
  returning * into v_order;

  insert into public.audit_log (
    order_id,
    actor_user_id,
    event_key,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_order_id,
    p_actor_user_id,
    case when p_due_at is null
      then 'asset.deadline_cleared'
      else 'asset.deadline_set'
    end,
    'order',
    p_order_id::text,
    jsonb_build_object(
      'asset_due_at', p_due_at,
      'note', nullif(trim(p_note), '')
    )
  );

  return query
  select v_order.id, v_order.order_number, v_order.asset_due_at;
end;
$$;

-- ------------------------------------------------------------------
-- Security
-- ------------------------------------------------------------------
alter table public.notification_provider_events enable row level security;
alter table public.notification_suppressions enable row level security;
alter table public.automation_job_locks enable row level security;

revoke all on table public.notification_provider_events from anon, authenticated;
revoke all on table public.notification_suppressions from anon, authenticated;
revoke all on table public.automation_job_locks from anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.notification_provider_events to service_role;
grant all on table public.notification_suppressions to service_role;
grant all on table public.automation_job_locks to service_role;
grant all on table public.notification_outbox to service_role;
grant all on table public.orders to service_role;

revoke all on function public.claim_notification_batch(integer) from public, anon, authenticated;
revoke all on function public.defer_notification(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.mark_notification_sent(uuid,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.mark_notification_failed(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.retry_notification(uuid) from public, anon, authenticated;
revoke all on function public.cancel_notification(uuid,text) from public, anon, authenticated;
revoke all on function public.record_notification_provider_event(text,text,text,text,text,jsonb,timestamptz) from public, anon, authenticated;
revoke all on function public.acquire_automation_lock(text,uuid,integer) from public, anon, authenticated;
revoke all on function public.release_automation_lock(text,uuid) from public, anon, authenticated;
revoke all on function public.set_order_asset_deadline(uuid,timestamptz,text,uuid) from public, anon, authenticated;

grant execute on function public.claim_notification_batch(integer) to service_role;
grant execute on function public.defer_notification(uuid,text,integer) to service_role;
grant execute on function public.mark_notification_sent(uuid,text,text,text,jsonb) to service_role;
grant execute on function public.mark_notification_failed(uuid,text,integer) to service_role;
grant execute on function public.retry_notification(uuid) to service_role;
grant execute on function public.cancel_notification(uuid,text) to service_role;
grant execute on function public.record_notification_provider_event(text,text,text,text,text,jsonb,timestamptz) to service_role;
grant execute on function public.acquire_automation_lock(text,uuid,integer) to service_role;
grant execute on function public.release_automation_lock(text,uuid) to service_role;
grant execute on function public.set_order_asset_deadline(uuid,timestamptz,text,uuid) to service_role;

commit;
