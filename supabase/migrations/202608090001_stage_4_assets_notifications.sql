-- La Grandiosa Commerce — Stage 4
-- Secure creative-asset upload, previews, version history, submission review,
-- revision requests, approval, manual release queue, and notification delivery.

begin;

-- ------------------------------------------------------------------
-- Asset and release enums
-- ------------------------------------------------------------------
do $$
begin
  create type public.asset_slot_status as enum (
    'awaiting_upload',
    'uploaded',
    'submitted',
    'revision_requested',
    'approved'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.asset_file_status as enum (
    'uploaded',
    'submitted',
    'approved',
    'revision_requested',
    'superseded',
    'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.asset_submission_status as enum (
    'submitted',
    'under_review',
    'revision_requested',
    'approved'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.asset_review_item_status as enum (
    'pending',
    'approved',
    'revision_requested'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.release_queue_status as enum (
    'pending',
    'processing',
    'released',
    'live',
    'failed',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------------
-- Configurable technical specifications
-- Pixel dimensions are deliberately null until the LED provider supplies
-- final pixel-resolution requirements.
-- ------------------------------------------------------------------
create table if not exists public.asset_specifications (
  id uuid primary key default gen_random_uuid(),
  format text not null check (format in ('still-image', 'silent-video')),
  screen_target text not null check (screen_target in ('left', 'center', 'right')),
  allowed_mime_types text[] not null,
  max_file_size_bytes bigint not null check (max_file_size_bytes > 0),
  expected_width_pixels integer,
  expected_height_pixels integer,
  duration_tolerance_seconds numeric(6, 3) not null default 0.5,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (format, screen_target)
);

drop trigger if exists asset_specifications_set_updated_at on public.asset_specifications;
create trigger asset_specifications_set_updated_at
before update on public.asset_specifications
for each row execute function public.set_updated_at();

insert into public.asset_specifications (
  format,
  screen_target,
  allowed_mime_types,
  max_file_size_bytes,
  expected_width_pixels,
  expected_height_pixels,
  duration_tolerance_seconds,
  notes
)
select format, screen_target, mime_types, max_bytes, null, null, 0.5,
  'Provisional upload rules. Final LED pixel dimensions remain pending provider confirmation.'
from (
  values
    ('still-image', 'left',   array['image/jpeg','image/png']::text[], 52428800::bigint),
    ('still-image', 'center', array['image/jpeg','image/png']::text[], 52428800::bigint),
    ('still-image', 'right',  array['image/jpeg','image/png']::text[], 52428800::bigint),
    ('silent-video', 'left',   array['video/mp4','video/quicktime']::text[], 524288000::bigint),
    ('silent-video', 'center', array['video/mp4','video/quicktime']::text[], 524288000::bigint),
    ('silent-video', 'right',  array['video/mp4','video/quicktime']::text[], 524288000::bigint)
) as defaults(format, screen_target, mime_types, max_bytes)
on conflict (format, screen_target) do nothing;

-- ------------------------------------------------------------------
-- Required asset slots and versioned files
-- ------------------------------------------------------------------
create table if not exists public.order_asset_slots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  slot_key text not null,
  screen_target text not null check (screen_target in ('left', 'center', 'right')),
  format text not null check (format in ('still-image', 'silent-video')),
  duration_seconds integer not null check (duration_seconds in (10, 15, 30, 60)),
  required boolean not null default true,
  status public.asset_slot_status not null default 'awaiting_upload',
  specification_snapshot jsonb not null default '{}'::jsonb,
  current_asset_file_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (order_item_id, screen_target)
);

create index if not exists order_asset_slots_order_idx
  on public.order_asset_slots (order_id, status, order_item_id);

drop trigger if exists order_asset_slots_set_updated_at on public.order_asset_slots;
create trigger order_asset_slots_set_updated_at
before update on public.order_asset_slots
for each row execute function public.set_updated_at();

create table if not exists public.asset_files (
  id uuid primary key default gen_random_uuid(),
  asset_slot_id uuid not null references public.order_asset_slots(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status public.asset_file_status not null default 'uploaded',
  storage_bucket text not null default 'campaign-assets',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  media_width_pixels integer,
  media_height_pixels integer,
  media_duration_seconds numeric(12, 3),
  client_metadata jsonb not null default '{}'::jsonb,
  uploaded_by_user_id uuid not null references auth.users(id),
  uploaded_at timestamptz not null default timezone('utc', now()),
  unique (asset_slot_id, version_number)
);

create index if not exists asset_files_slot_idx
  on public.asset_files (asset_slot_id, version_number desc);

alter table public.order_asset_slots
  drop constraint if exists order_asset_slots_current_asset_file_id_fkey;
alter table public.order_asset_slots
  add constraint order_asset_slots_current_asset_file_id_fkey
  foreign key (current_asset_file_id)
  references public.asset_files(id)
  on delete set null;

-- ------------------------------------------------------------------
-- Review submissions
-- ------------------------------------------------------------------
create table if not exists public.asset_submissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  submission_number integer not null check (submission_number > 0),
  status public.asset_submission_status not null default 'submitted',
  submitted_by_user_id uuid not null references auth.users(id),
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewer_user_id uuid references auth.users(id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (order_id, submission_number)
);

create index if not exists asset_submissions_status_idx
  on public.asset_submissions (status, submitted_at);

drop trigger if exists asset_submissions_set_updated_at on public.asset_submissions;
create trigger asset_submissions_set_updated_at
before update on public.asset_submissions
for each row execute function public.set_updated_at();

create table if not exists public.asset_submission_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.asset_submissions(id) on delete cascade,
  asset_slot_id uuid not null references public.order_asset_slots(id) on delete cascade,
  asset_file_id uuid not null references public.asset_files(id),
  status public.asset_review_item_status not null default 'pending',
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (submission_id, asset_slot_id)
);

create index if not exists asset_submission_items_submission_idx
  on public.asset_submission_items (submission_id, status);

-- ------------------------------------------------------------------
-- Future LED provider release queue
-- ------------------------------------------------------------------
create table if not exists public.asset_release_queue (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  asset_submission_id uuid not null references public.asset_submissions(id),
  provider_key text not null default 'manual_pending_provider',
  status public.release_queue_status not null default 'pending',
  request_payload jsonb not null default '{}'::jsonb,
  external_reference text,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  queued_at timestamptz not null default timezone('utc', now()),
  processing_started_at timestamptz,
  released_at timestamptz,
  live_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (asset_submission_id)
);

create index if not exists asset_release_queue_status_idx
  on public.asset_release_queue (status, queued_at);

drop trigger if exists asset_release_queue_set_updated_at on public.asset_release_queue;
create trigger asset_release_queue_set_updated_at
before update on public.asset_release_queue
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- Private campaign-asset bucket
-- 500 MB is a provisional application limit for video assets.
-- ------------------------------------------------------------------
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'campaign-assets',
  'campaign-assets',
  false,
  524288000,
  array['image/jpeg','image/png','video/mp4','video/quicktime']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No public object policies are created. Uploads use server-generated signed
-- TUS tokens. Downloads use short-lived server-generated signed URLs.

-- ------------------------------------------------------------------
-- Slot generation helpers
-- ------------------------------------------------------------------
create or replace function public.asset_screen_targets_for_package(
  p_screen_package text
)
returns text[]
language sql
immutable
as $$
  select case p_screen_package
    when 'left' then array['left']::text[]
    when 'center' then array['center']::text[]
    when 'right' then array['right']::text[]
    when 'left-right' then array['left','right']::text[]
    when 'all-3' then array['left','center','right']::text[]
    else array[]::text[]
  end;
$$;

create or replace function public.ensure_order_asset_slots(
  p_order_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_status public.order_status;
  v_item record;
  v_target text;
  v_spec public.asset_specifications%rowtype;
  v_inserted integer := 0;
begin
  select status into v_order_status
  from public.orders
  where id = p_order_id;

  if v_order_status is null then
    raise exception 'Order not found.';
  end if;

  if v_order_status not in (
    'awaiting_assets',
    'assets_received',
    'under_review',
    'revision_requested',
    'approved',
    'release_pending',
    'released',
    'live'
  ) then
    raise exception 'Asset slots are not available for order status %.', v_order_status;
  end if;

  for v_item in
    select
      id,
      order_id,
      combination_snapshot,
      coalesce(combination_snapshot->>'screenPackage', '') as screen_package,
      coalesce(combination_snapshot->>'format', '') as format,
      coalesce((combination_snapshot->>'durationSeconds')::integer, 0) as duration_seconds
    from public.order_items
    where order_id = p_order_id
    order by sort_order, created_at
  loop
    foreach v_target in array public.asset_screen_targets_for_package(v_item.screen_package)
    loop
      select * into v_spec
      from public.asset_specifications
      where format = v_item.format
        and screen_target = v_target
        and active = true
      limit 1;

      if not found then
        raise exception 'No active asset specification for % / %.', v_item.format, v_target;
      end if;

      insert into public.order_asset_slots (
        order_id,
        order_item_id,
        slot_key,
        screen_target,
        format,
        duration_seconds,
        specification_snapshot
      )
      values (
        p_order_id,
        v_item.id,
        v_item.id::text || '-' || v_target,
        v_target,
        v_item.format,
        v_item.duration_seconds,
        jsonb_build_object(
          'allowedMimeTypes', v_spec.allowed_mime_types,
          'maxFileSizeBytes', v_spec.max_file_size_bytes,
          'expectedWidthPixels', v_spec.expected_width_pixels,
          'expectedHeightPixels', v_spec.expected_height_pixels,
          'expectedDurationSeconds', case when v_item.format = 'silent-video' then v_item.duration_seconds else null end,
          'durationToleranceSeconds', v_spec.duration_tolerance_seconds,
          'notes', v_spec.notes
        )
      )
      on conflict (order_item_id, screen_target) do nothing;

      if found then
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end loop;

  return v_inserted;
end;
$$;

create or replace function public.register_order_asset_file(
  p_asset_slot_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_media_width_pixels integer,
  p_media_height_pixels integer,
  p_media_duration_seconds numeric,
  p_client_metadata jsonb,
  p_actor_user_id uuid
)
returns table(asset_file_id uuid, version_number integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.order_asset_slots%rowtype;
  v_order_status public.order_status;
  v_allowed text[];
  v_max bigint;
  v_version integer;
  v_file_id uuid;
begin
  select *
  into v_slot
  from public.order_asset_slots
  where id = p_asset_slot_id
  for update;

  if not found then
    raise exception 'Asset slot not found.';
  end if;

  select status
  into v_order_status
  from public.orders
  where id = v_slot.order_id;

  if v_order_status not in ('awaiting_assets', 'revision_requested', 'assets_received') then
    raise exception 'New uploads are not allowed while the order status is %.', v_order_status;
  end if;

  select array(select jsonb_array_elements_text(v_slot.specification_snapshot->'allowedMimeTypes'))
  into v_allowed;
  v_max := coalesce((v_slot.specification_snapshot->>'maxFileSizeBytes')::bigint, 0);

  if not (p_mime_type = any(v_allowed)) then
    raise exception 'File type % is not allowed for this asset slot.', p_mime_type;
  end if;

  if p_file_size_bytes <= 0 or p_file_size_bytes > v_max then
    raise exception 'File size is outside the allowed limit.';
  end if;

  select coalesce(max(files.version_number), 0) + 1
  into v_version
  from public.asset_files files
  where files.asset_slot_id = p_asset_slot_id;

  update public.asset_files
  set status = 'superseded'
  where asset_slot_id = p_asset_slot_id
    and status = 'uploaded';

  insert into public.asset_files (
    asset_slot_id,
    version_number,
    storage_path,
    original_filename,
    mime_type,
    file_size_bytes,
    media_width_pixels,
    media_height_pixels,
    media_duration_seconds,
    client_metadata,
    uploaded_by_user_id
  )
  values (
    p_asset_slot_id,
    v_version,
    p_storage_path,
    p_original_filename,
    p_mime_type,
    p_file_size_bytes,
    p_media_width_pixels,
    p_media_height_pixels,
    p_media_duration_seconds,
    coalesce(p_client_metadata, '{}'::jsonb),
    p_actor_user_id
  )
  returning id into v_file_id;

  update public.order_asset_slots
  set
    current_asset_file_id = v_file_id,
    status = 'uploaded'
  where id = p_asset_slot_id;

  insert into public.audit_log (
    order_id,
    actor_user_id,
    event_key,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_slot.order_id,
    p_actor_user_id,
    'asset.file_uploaded',
    'asset_file',
    v_file_id::text,
    jsonb_build_object(
      'slot_id', p_asset_slot_id,
      'screen_target', v_slot.screen_target,
      'version_number', v_version,
      'filename', p_original_filename,
      'file_size_bytes', p_file_size_bytes
    )
  );

  return query select v_file_id, v_version;
end;
$$;

create or replace function public.submit_order_assets(
  p_order_id uuid,
  p_actor_user_id uuid
)
returns table(asset_submission_id uuid, submission_number integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_status public.order_status;
  v_submission_id uuid;
  v_submission_number integer;
  v_missing integer;
begin
  perform public.ensure_order_asset_slots(p_order_id);

  select status into v_order_status
  from public.orders
  where id = p_order_id
  for update;

  if v_order_status not in ('awaiting_assets', 'revision_requested', 'assets_received') then
    raise exception 'Assets cannot be submitted while the order status is %.', v_order_status;
  end if;

  select count(*) into v_missing
  from public.order_asset_slots
  where order_id = p_order_id
    and required = true
    and current_asset_file_id is null;

  if v_missing > 0 then
    raise exception '% required asset slot(s) do not have an uploaded file.', v_missing;
  end if;

  select coalesce(max(submission_number), 0) + 1
  into v_submission_number
  from public.asset_submissions
  where order_id = p_order_id;

  insert into public.asset_submissions (
    order_id,
    submission_number,
    status,
    submitted_by_user_id
  )
  values (
    p_order_id,
    v_submission_number,
    'submitted',
    p_actor_user_id
  )
  returning id into v_submission_id;

  insert into public.asset_submission_items (
    submission_id,
    asset_slot_id,
    asset_file_id,
    status
  )
  select
    v_submission_id,
    slot.id,
    slot.current_asset_file_id,
    case when slot.status = 'approved'
      then 'approved'::public.asset_review_item_status
      else 'pending'::public.asset_review_item_status
    end
  from public.order_asset_slots slot
  where slot.order_id = p_order_id
    and slot.required = true;

  update public.asset_files files
  set status = 'submitted'
  from public.order_asset_slots slots
  where slots.order_id = p_order_id
    and slots.current_asset_file_id = files.id
    and files.status <> 'approved';

  update public.order_asset_slots
  set status = case
    when status = 'approved' then 'approved'::public.asset_slot_status
    else 'submitted'::public.asset_slot_status
  end
  where order_id = p_order_id;

  if v_order_status in ('awaiting_assets', 'revision_requested') then
    perform public.transition_order_status(
      p_order_id,
      'assets_received',
      p_actor_user_id,
      'Final advertising assets submitted for review.',
      jsonb_build_object('asset_submission_id', v_submission_id, 'submission_number', v_submission_number)
    );
  end if;

  perform public.transition_order_status(
    p_order_id,
    'under_review',
    p_actor_user_id,
    'Advertising assets entered processing-team review.',
    jsonb_build_object('asset_submission_id', v_submission_id, 'submission_number', v_submission_number)
  );

  update public.asset_submissions
  set status = 'under_review'
  where id = v_submission_id;

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
    'asset.submission_received',
    'asset_submission',
    v_submission_id::text,
    jsonb_build_object('submission_number', v_submission_number)
  );

  return query select v_submission_id, v_submission_number;
end;
$$;

create or replace function public.review_asset_submission(
  p_asset_submission_id uuid,
  p_decision text,
  p_review_note text,
  p_item_decisions jsonb,
  p_actor_user_id uuid
)
returns table(
  order_id uuid,
  order_number text,
  submission_status public.asset_submission_status,
  release_queue_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.asset_submissions%rowtype;
  v_order public.orders%rowtype;
  v_release_id uuid;
  v_revision_count integer;
begin
  select * into v_submission
  from public.asset_submissions
  where id = p_asset_submission_id
  for update;

  if not found then
    raise exception 'Asset submission not found.';
  end if;

  if v_submission.status not in ('submitted', 'under_review') then
    raise exception 'This asset submission is no longer awaiting review.';
  end if;

  select * into v_order
  from public.orders
  where id = v_submission.order_id
  for update;

  if p_decision = 'approve' then
    update public.asset_submission_items
    set status = 'approved', reviewer_note = null, reviewed_at = timezone('utc', now())
    where submission_id = v_submission.id;

    update public.asset_files files
    set status = 'approved'
    from public.asset_submission_items items
    where items.submission_id = v_submission.id
      and items.asset_file_id = files.id;

    update public.order_asset_slots slots
    set status = 'approved'
    from public.asset_submission_items items
    where items.submission_id = v_submission.id
      and items.asset_slot_id = slots.id;

    update public.asset_submissions
    set
      status = 'approved',
      reviewer_user_id = p_actor_user_id,
      review_note = nullif(trim(p_review_note), ''),
      reviewed_at = timezone('utc', now())
    where id = v_submission.id;

    perform public.transition_order_status(
      v_order.id,
      'approved',
      p_actor_user_id,
      'Advertising assets approved.',
      jsonb_build_object('asset_submission_id', v_submission.id)
    );

    perform public.transition_order_status(
      v_order.id,
      'release_pending',
      p_actor_user_id,
      'Approved assets entered the release queue.',
      jsonb_build_object('asset_submission_id', v_submission.id)
    );

    insert into public.asset_release_queue (
      order_id,
      asset_submission_id,
      provider_key,
      status,
      request_payload
    )
    values (
      v_order.id,
      v_submission.id,
      'manual_pending_provider',
      'pending',
      jsonb_build_object(
        'order_number', v_order.order_number,
        'asset_submission_id', v_submission.id,
        'provider_api_status', 'pending_confirmation'
      )
    )
    on conflict (asset_submission_id) do update
    set status = 'pending', last_error = null
    returning id into v_release_id;

    return query select v_order.id, v_order.order_number, 'approved'::public.asset_submission_status, v_release_id;

  elsif p_decision = 'revision' then
    with decisions as (
      select
        (entry->>'slotId')::uuid as slot_id,
        coalesce(nullif(entry->>'note', ''), nullif(trim(p_review_note), '')) as note
      from jsonb_array_elements(coalesce(p_item_decisions, '[]'::jsonb)) entry
      where coalesce((entry->>'needsRevision')::boolean, false) = true
    )
    select count(*) into v_revision_count from decisions;

    if v_revision_count = 0 then
      raise exception 'Select at least one asset slot that requires revision.';
    end if;

    update public.asset_submission_items items
    set
      status = case when decisions.slot_id is not null
        then 'revision_requested'::public.asset_review_item_status
        else 'approved'::public.asset_review_item_status
      end,
      reviewer_note = decisions.note,
      reviewed_at = timezone('utc', now())
    from (
      select
        base.id as item_id,
        d.slot_id,
        d.note
      from public.asset_submission_items base
      left join (
        select
          (entry->>'slotId')::uuid as slot_id,
          coalesce(nullif(entry->>'note', ''), nullif(trim(p_review_note), '')) as note
        from jsonb_array_elements(coalesce(p_item_decisions, '[]'::jsonb)) entry
        where coalesce((entry->>'needsRevision')::boolean, false) = true
      ) d on d.slot_id = base.asset_slot_id
      where base.submission_id = v_submission.id
    ) decisions
    where items.id = decisions.item_id;

    update public.asset_files files
    set status = case when items.status = 'revision_requested'
      then 'revision_requested'::public.asset_file_status
      else 'approved'::public.asset_file_status
    end
    from public.asset_submission_items items
    where items.submission_id = v_submission.id
      and items.asset_file_id = files.id;

    update public.order_asset_slots slots
    set status = case when items.status = 'revision_requested'
      then 'revision_requested'::public.asset_slot_status
      else 'approved'::public.asset_slot_status
    end
    from public.asset_submission_items items
    where items.submission_id = v_submission.id
      and items.asset_slot_id = slots.id;

    update public.asset_submissions
    set
      status = 'revision_requested',
      reviewer_user_id = p_actor_user_id,
      review_note = nullif(trim(p_review_note), ''),
      reviewed_at = timezone('utc', now())
    where id = v_submission.id;

    perform public.transition_order_status(
      v_order.id,
      'revision_requested',
      p_actor_user_id,
      'Advertising asset revision requested.',
      jsonb_build_object('asset_submission_id', v_submission.id, 'revision_slots', v_revision_count)
    );

    return query select v_order.id, v_order.order_number, 'revision_requested'::public.asset_submission_status, null::uuid;
  else
    raise exception 'Asset-review decision is invalid.';
  end if;
end;
$$;

create or replace function public.update_asset_release_status(
  p_release_queue_id uuid,
  p_action text,
  p_external_reference text,
  p_note text,
  p_actor_user_id uuid
)
returns table(order_id uuid, order_number text, release_status public.release_queue_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_release public.asset_release_queue%rowtype;
  v_order public.orders%rowtype;
  v_new_status public.release_queue_status;
begin
  select * into v_release
  from public.asset_release_queue
  where id = p_release_queue_id
  for update;

  if not found then
    raise exception 'Release queue item not found.';
  end if;

  select * into v_order from public.orders where id = v_release.order_id for update;

  if p_action = 'released' then
    v_new_status := 'released';
    update public.asset_release_queue
    set status = v_new_status,
        external_reference = nullif(trim(p_external_reference), ''),
        released_at = timezone('utc', now()),
        last_error = null
    where id = v_release.id;
    perform public.transition_order_status(v_order.id, 'released', p_actor_user_id, coalesce(nullif(trim(p_note), ''), 'Assets released to the screen workflow.'), jsonb_build_object('release_queue_id', v_release.id));
  elsif p_action = 'live' then
    if v_order.status <> 'released' then
      raise exception 'The campaign must be released before it can be marked live.';
    end if;
    v_new_status := 'live';
    update public.asset_release_queue
    set status = v_new_status,
        external_reference = coalesce(nullif(trim(p_external_reference), ''), external_reference),
        live_at = timezone('utc', now()),
        last_error = null
    where id = v_release.id;
    perform public.transition_order_status(v_order.id, 'live', p_actor_user_id, coalesce(nullif(trim(p_note), ''), 'Campaign marked live.'), jsonb_build_object('release_queue_id', v_release.id));
  elsif p_action = 'failed' then
    v_new_status := 'failed';
    update public.asset_release_queue
    set status = v_new_status,
        attempts = attempts + 1,
        last_error = coalesce(nullif(trim(p_note), ''), 'Manual release failed.')
    where id = v_release.id;
  else
    raise exception 'Release action is invalid.';
  end if;

  insert into public.audit_log(order_id, actor_user_id, event_key, entity_type, entity_id, metadata)
  values(v_order.id, p_actor_user_id, 'asset.release_' || p_action, 'asset_release_queue', v_release.id::text,
    jsonb_build_object('external_reference', nullif(trim(p_external_reference), ''), 'note', nullif(trim(p_note), '')));

  return query select v_order.id, v_order.order_number, v_new_status;
end;
$$;

-- ------------------------------------------------------------------
-- Notification provider metadata and atomic worker functions
-- ------------------------------------------------------------------
alter table public.notification_outbox
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists provider_status text,
  add column if not exists provider_payload jsonb not null default '{}'::jsonb,
  add column if not exists delivered_at timestamptz;

create index if not exists notification_outbox_provider_message_idx
  on public.notification_outbox (provider, provider_message_id)
  where provider_message_id is not null;

create or replace function public.claim_notification_batch(p_limit integer default 20)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
    from public.notification_outbox
    where status in ('queued', 'failed')
      and next_attempt_at <= timezone('utc', now())
      and attempts < 6
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.notification_outbox outbox
  set
    status = 'processing',
    attempts = attempts + 1,
    updated_at = timezone('utc', now())
  from candidates
  where outbox.id = candidates.id
  returning outbox.*;
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
    last_error = null,
    sent_at = timezone('utc', now()),
    delivered_at = case when p_provider_status = 'delivered' then timezone('utc', now()) else delivered_at end
  where id = p_notification_id;
end;
$$;

create or replace function public.mark_notification_failed(
  p_notification_id uuid,
  p_error text,
  p_retry_after_seconds integer default 300
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_outbox
  set
    status = 'failed',
    last_error = left(coalesce(p_error, 'Unknown delivery error'), 2000),
    next_attempt_at = timezone('utc', now()) + make_interval(secs => greatest(60, coalesce(p_retry_after_seconds, 300)))
  where id = p_notification_id;
end;
$$;

-- ------------------------------------------------------------------
-- Security
-- ------------------------------------------------------------------
alter table public.asset_specifications enable row level security;
alter table public.order_asset_slots enable row level security;
alter table public.asset_files enable row level security;
alter table public.asset_submissions enable row level security;
alter table public.asset_submission_items enable row level security;
alter table public.asset_release_queue enable row level security;

revoke all on table public.asset_specifications from anon, authenticated;
revoke all on table public.order_asset_slots from anon, authenticated;
revoke all on table public.asset_files from anon, authenticated;
revoke all on table public.asset_submissions from anon, authenticated;
revoke all on table public.asset_submission_items from anon, authenticated;
revoke all on table public.asset_release_queue from anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.asset_specifications to service_role;
grant all on table public.order_asset_slots to service_role;
grant all on table public.asset_files to service_role;
grant all on table public.asset_submissions to service_role;
grant all on table public.asset_submission_items to service_role;
grant all on table public.asset_release_queue to service_role;
grant all on table public.notification_outbox to service_role;

revoke all on function public.asset_screen_targets_for_package(text) from public, anon, authenticated;
revoke all on function public.ensure_order_asset_slots(uuid) from public, anon, authenticated;
revoke all on function public.register_order_asset_file(uuid,text,text,text,bigint,integer,integer,numeric,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.submit_order_assets(uuid,uuid) from public, anon, authenticated;
revoke all on function public.review_asset_submission(uuid,text,text,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.update_asset_release_status(uuid,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.claim_notification_batch(integer) from public, anon, authenticated;
revoke all on function public.mark_notification_sent(uuid,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.mark_notification_failed(uuid,text,integer) from public, anon, authenticated;

grant execute on function public.asset_screen_targets_for_package(text) to service_role;
grant execute on function public.ensure_order_asset_slots(uuid) to service_role;
grant execute on function public.register_order_asset_file(uuid,text,text,text,bigint,integer,integer,numeric,jsonb,uuid) to service_role;
grant execute on function public.submit_order_assets(uuid,uuid) to service_role;
grant execute on function public.review_asset_submission(uuid,text,text,jsonb,uuid) to service_role;
grant execute on function public.update_asset_release_status(uuid,text,text,text,uuid) to service_role;
grant execute on function public.claim_notification_batch(integer) to service_role;
grant execute on function public.mark_notification_sent(uuid,text,text,text,jsonb) to service_role;
grant execute on function public.mark_notification_failed(uuid,text,integer) to service_role;

commit;
