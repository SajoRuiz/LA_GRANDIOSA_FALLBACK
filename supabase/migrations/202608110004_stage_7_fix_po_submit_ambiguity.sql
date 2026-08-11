-- Stage 7 patch: disambiguate purchase_order_id reference in
-- submit_agency_purchase_order.

create or replace function public.submit_agency_purchase_order(
  p_order_id uuid,
  p_po_number text,
  p_issue_date date,
  p_note text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_actor_user_id uuid
)
returns table(
  purchase_order_id uuid,
  order_number text,
  po_status public.purchase_order_status,
  document_version integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_po public.purchase_orders%rowtype;
  v_version integer;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found.'; end if;

  if v_order.status not in (
    'client_information_received', 'po_submitted', 'po_revision_requested'
  ) then
    raise exception 'This order is not accepting a purchase order.';
  end if;

  if v_order.credit_status = 'exception_declined' then
    raise exception 'The order credit exception was declined.';
  end if;

  if trim(coalesce(p_po_number, '')) = '' then
    raise exception 'Purchase-order number is required.';
  end if;

  if p_mime_type <> 'application/pdf'
     or p_file_size_bytes <= 0
     or p_file_size_bytes > 15728640 then
    raise exception 'The purchase-order document must be a PDF up to 15 MB.';
  end if;

  select * into v_po
  from public.purchase_orders
  where order_id = p_order_id
  for update;

  if not found then
    insert into public.purchase_orders (
      order_id, agency_id, po_number, issue_date, status, note,
      submitted_by_user_id, submitted_at
    )
    values (
      p_order_id, v_order.agency_id, trim(p_po_number), p_issue_date,
      'submitted', nullif(trim(p_note), ''), p_actor_user_id,
      timezone('utc', now())
    )
    returning * into v_po;
  else
    update public.purchase_orders
    set po_number = trim(p_po_number),
        issue_date = p_issue_date,
        status = 'submitted',
        note = nullif(trim(p_note), ''),
        submitted_by_user_id = p_actor_user_id,
        submitted_at = timezone('utc', now()),
        reviewer_user_id = null,
        reviewer_note = null,
        reviewed_at = null
    where id = v_po.id
    returning * into v_po;
  end if;

  select coalesce(max(pod.version_number), 0) + 1
  into v_version
  from public.purchase_order_documents pod
  where pod.purchase_order_id = v_po.id;

  insert into public.purchase_order_documents (
    purchase_order_id, version_number, storage_path, original_filename,
    mime_type, file_size_bytes, uploaded_by_user_id
  )
  values (
    v_po.id, v_version, p_storage_path, p_original_filename,
    p_mime_type, p_file_size_bytes, p_actor_user_id
  );

  if v_order.status <> 'po_submitted' then
    perform public.transition_order_status(
      p_order_id, 'po_submitted', p_actor_user_id,
      'Agency purchase order submitted.',
      jsonb_build_object(
        'purchase_order_id', v_po.id,
        'po_number', trim(p_po_number),
        'document_version', v_version
      )
    );
  end if;

  update public.client_contacts
  set purchase_order_number = trim(p_po_number)
  where id = v_order.client_contact_id;

  insert into public.audit_log (
    order_id, actor_user_id, event_key, entity_type, entity_id, metadata
  )
  values (
    p_order_id, p_actor_user_id, 'purchase_order.submitted',
    'purchase_order', v_po.id::text,
    jsonb_build_object(
      'po_number', trim(p_po_number),
      'document_version', v_version,
      'storage_path', p_storage_path
    )
  );

  return query select v_po.id, v_order.order_number, v_po.status, v_version;
end;
$$;

revoke all on function public.submit_agency_purchase_order(
  uuid, text, date, text, text, text, text, bigint, uuid
) from public, anon;

grant execute on function public.submit_agency_purchase_order(
  uuid, text, date, text, text, text, text, bigint, uuid
) to authenticated, service_role;