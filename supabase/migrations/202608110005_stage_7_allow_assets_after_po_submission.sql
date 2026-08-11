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
    'po_submitted',
    'po_revision_requested',
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
      on conflict (slot_key) do nothing;

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

  if v_order_status not in ('po_submitted', 'po_revision_requested', 'awaiting_assets', 'revision_requested', 'assets_received') then
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

  if v_order_status not in ('po_submitted', 'po_revision_requested', 'awaiting_assets', 'revision_requested', 'assets_received') then
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
    slots.id,
    slots.current_asset_file_id,
    'pending'
  from public.order_asset_slots slots
  where slots.order_id = p_order_id
    and slots.current_asset_file_id is not null;

  update public.asset_files
  set status = 'submitted'
  where asset_slot_id in (
      select id from public.order_asset_slots where order_id = p_order_id
    )
    and id in (
      select current_asset_file_id
      from public.order_asset_slots
      where order_id = p_order_id
    );

  update public.order_asset_slots
  set status = 'submitted'
  where order_id = p_order_id;

  if v_order_status in ('po_submitted', 'po_revision_requested', 'awaiting_assets', 'revision_requested') then
    perform public.transition_order_status(
      p_order_id,
      'assets_received',
      p_actor_user_id,
      'Agency assets submitted for review.',
      jsonb_build_object(
        'asset_submission_id', v_submission_id,
        'submission_number', v_submission_number
      )
    );
  end if;

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
    'asset.submission_created',
    'asset_submission',
    v_submission_id::text,
    jsonb_build_object(
      'submission_number', v_submission_number
    )
  );

  return query select v_submission_id, v_submission_number;
end;
$$;