-- La Grandiosa Commerce — Stage 3B-C
-- Purchase-order upload and review, invoice issuance, secure remittance
-- accounts, manual payment recording, and notification-outbox events.

-- Commit new enum values before later statements reference them.
begin;
alter type public.order_status add value if not exists 'po_submitted';
alter type public.order_status add value if not exists 'po_revision_requested';
alter type public.order_status add value if not exists 'po_approved';
alter type public.order_status add value if not exists 'invoice_issued';
alter type public.payment_method add value if not exists 'wire';
commit;

begin;

create extension if not exists supabase_vault cascade;

do $$
begin
  create type public.purchase_order_status as enum (
    'submitted',
    'revision_requested',
    'approved',
    'declined',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.invoice_status as enum (
    'draft',
    'issued',
    'partially_paid',
    'paid',
    'overdue',
    'disputed',
    'void',
    'written_off'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.invoice_payment_method as enum (
    'ach',
    'wire',
    'check',
    'manual',
    'future_card'
  );
exception
  when duplicate_object then null;
end $$;

create sequence if not exists public.invoice_number_seq start 1;

create or replace function public.next_invoice_number()
returns text
language sql
security definer
set search_path = public
as $$
  select
    'LG-INV-' ||
    to_char(timezone('utc', now()), 'YYYY') ||
    '-' ||
    lpad(nextval('public.invoice_number_seq')::text, 6, '0');
$$;

create table if not exists public.remittance_accounts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  bank_name text not null,
  beneficiary_name text not null,
  account_type text not null check (account_type in ('checking', 'savings')),
  routing_secret_id uuid not null,
  account_secret_id uuid not null,
  account_last4 text not null check (account_last4 ~ '^[0-9]{4}$'),
  remittance_email text,
  ach_enabled boolean not null default true,
  wire_enabled boolean not null default true,
  instructions text,
  active boolean not null default true,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists remittance_accounts_one_active_idx
  on public.remittance_accounts ((active))
  where active = true;

drop trigger if exists remittance_accounts_set_updated_at
  on public.remittance_accounts;
create trigger remittance_accounts_set_updated_at
before update on public.remittance_accounts
for each row execute function public.set_updated_at();

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  agency_id uuid not null references public.agency_accounts(id) on delete cascade,
  po_number text not null,
  issue_date date,
  status public.purchase_order_status not null default 'submitted',
  note text,
  submitted_by_user_id uuid not null references auth.users(id),
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewer_user_id uuid references auth.users(id),
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists purchase_orders_agency_status_idx
  on public.purchase_orders (agency_id, status, submitted_at desc);
create index if not exists purchase_orders_status_idx
  on public.purchase_orders (status, submitted_at desc);

drop trigger if exists purchase_orders_set_updated_at
  on public.purchase_orders;
create trigger purchase_orders_set_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

create table if not exists public.purchase_order_documents (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  storage_bucket text not null default 'purchase-orders',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type = 'application/pdf'),
  file_size_bytes bigint not null check (
    file_size_bytes > 0 and file_size_bytes <= 15728640
  ),
  uploaded_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  unique (purchase_order_id, version_number)
);

create index if not exists purchase_order_documents_po_idx
  on public.purchase_order_documents (purchase_order_id, version_number desc);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  agency_id uuid not null references public.agency_accounts(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id),
  remittance_account_id uuid not null references public.remittance_accounts(id),
  status public.invoice_status not null default 'issued',
  currency text not null default 'USD' check (currency = 'USD'),
  invoice_date date not null default current_date,
  due_date date not null,
  pre_discount_total_cents bigint not null default 0 check (pre_discount_total_cents >= 0),
  published_total_cents bigint not null default 0 check (published_total_cents >= 0),
  campaign_discount_cents bigint not null default 0 check (campaign_discount_cents >= 0),
  agency_discount_cents bigint not null default 0 check (agency_discount_cents >= 0),
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  paid_cents bigint not null default 0 check (paid_cents >= 0),
  balance_cents bigint not null check (balance_cents >= 0),
  payment_terms_days integer not null default 30 check (payment_terms_days between 0 and 365),
  client_snapshot jsonb not null default '{}'::jsonb,
  agency_snapshot jsonb not null default '{}'::jsonb,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  remittance_snapshot jsonb not null default '{}'::jsonb,
  issued_by_user_id uuid not null references auth.users(id),
  issued_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (paid_cents <= total_cents),
  check (balance_cents = total_cents - paid_cents)
);

create index if not exists invoices_agency_status_idx
  on public.invoices (agency_id, status, invoice_date desc);
create index if not exists invoices_due_date_idx
  on public.invoices (status, due_date);

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  sort_order integer not null default 0,
  description text not null,
  service_period text,
  quantity numeric(12, 2) not null default 1,
  unit_amount_cents bigint not null default 0,
  line_total_cents bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists invoice_items_invoice_idx
  on public.invoice_items (invoice_id, sort_order);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  agency_id uuid not null references public.agency_accounts(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  method public.invoice_payment_method not null,
  received_date date not null,
  reference text,
  note text,
  recorded_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists invoice_payments_invoice_idx
  on public.invoice_payments (invoice_id, received_date desc);

create table if not exists public.invoice_status_history (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  previous_status public.invoice_status,
  new_status public.invoice_status not null,
  actor_user_id uuid references auth.users(id),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists invoice_status_history_invoice_idx
  on public.invoice_status_history (invoice_id, created_at desc);

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'purchase-orders', 'purchase-orders', false, 15728640,
  array['application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into public.order_status_transition_rules (from_status, to_status)
values
  ('client_information_received', 'po_submitted'),
  ('po_submitted', 'po_revision_requested'),
  ('po_revision_requested', 'po_submitted'),
  ('po_submitted', 'po_approved'),
  ('po_submitted', 'cancelled'),
  ('po_revision_requested', 'cancelled'),
  ('po_approved', 'invoice_issued'),
  ('invoice_issued', 'awaiting_assets')
on conflict do nothing;

create or replace function public.create_remittance_account(
  p_display_name text,
  p_bank_name text,
  p_beneficiary_name text,
  p_account_type text,
  p_routing_number text,
  p_account_number text,
  p_remittance_email text,
  p_ach_enabled boolean,
  p_wire_enabled boolean,
  p_instructions text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid := gen_random_uuid();
  v_routing_id uuid;
  v_account_id uuid;
  v_last4 text;
begin
  if trim(coalesce(p_display_name, '')) = ''
     or trim(coalesce(p_bank_name, '')) = ''
     or trim(coalesce(p_beneficiary_name, '')) = '' then
    raise exception 'Display name, bank name, and beneficiary are required.';
  end if;

  if p_account_type not in ('checking', 'savings') then
    raise exception 'Account type is invalid.';
  end if;

  if trim(coalesce(p_routing_number, '')) !~ '^[0-9]{9}$' then
    raise exception 'Routing number must contain exactly 9 digits.';
  end if;

  if trim(coalesce(p_account_number, '')) !~ '^[0-9]{4,24}$' then
    raise exception 'Account number must contain 4 to 24 digits.';
  end if;

  v_last4 := right(trim(p_account_number), 4);

  select vault.create_secret(
    trim(p_routing_number),
    'lg-remittance-routing-' || v_id::text,
    'La Grandiosa remittance routing number'
  ) into v_routing_id;

  select vault.create_secret(
    trim(p_account_number),
    'lg-remittance-account-' || v_id::text,
    'La Grandiosa remittance account number'
  ) into v_account_id;

  update public.remittance_accounts set active = false where active = true;

  insert into public.remittance_accounts (
    id, display_name, bank_name, beneficiary_name, account_type,
    routing_secret_id, account_secret_id, account_last4,
    remittance_email, ach_enabled, wire_enabled, instructions,
    active, created_by_user_id
  )
  values (
    v_id, trim(p_display_name), trim(p_bank_name),
    trim(p_beneficiary_name), p_account_type,
    v_routing_id, v_account_id, v_last4,
    nullif(lower(trim(p_remittance_email)), ''),
    coalesce(p_ach_enabled, true), coalesce(p_wire_enabled, true),
    nullif(trim(p_instructions), ''), true, p_actor_user_id
  );

  return v_id;
end;
$$;

create or replace function public.get_remittance_account_secure(
  p_remittance_account_id uuid
)
returns table(
  id uuid,
  display_name text,
  bank_name text,
  beneficiary_name text,
  account_type text,
  routing_number text,
  account_number text,
  account_last4 text,
  remittance_email text,
  ach_enabled boolean,
  wire_enabled boolean,
  instructions text,
  active boolean
)
language sql
stable
security definer
set search_path = public, vault
as $$
  select
    account.id,
    account.display_name,
    account.bank_name,
    account.beneficiary_name,
    account.account_type,
    routing.decrypted_secret,
    bank_account.decrypted_secret,
    account.account_last4,
    account.remittance_email,
    account.ach_enabled,
    account.wire_enabled,
    account.instructions,
    account.active
  from public.remittance_accounts account
  join vault.decrypted_secrets routing
    on routing.id = account.routing_secret_id
  join vault.decrypted_secrets bank_account
    on bank_account.id = account.account_secret_id
  where account.id = p_remittance_account_id;
$$;

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

  select coalesce(max(version_number), 0) + 1
  into v_version
  from public.purchase_order_documents
  where purchase_order_id = v_po.id;

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

create or replace function public.review_purchase_order(
  p_purchase_order_id uuid,
  p_decision text,
  p_reviewer_note text,
  p_actor_user_id uuid
)
returns table(
  order_id uuid,
  order_number text,
  po_status public.purchase_order_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_order public.orders%rowtype;
  v_status public.purchase_order_status;
begin
  select * into v_po
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;

  if not found then raise exception 'Purchase order not found.'; end if;
  if v_po.status <> 'submitted' then
    raise exception 'This purchase order is no longer awaiting review.';
  end if;

  select * into v_order
  from public.orders
  where id = v_po.order_id
  for update;

  if p_decision = 'approve' then
    if v_order.credit_status not in ('within_limit', 'exception_approved') then
      raise exception 'Credit approval is required before the PO can be approved.';
    end if;
    v_status := 'approved';
    update public.purchase_orders
    set status = v_status,
        reviewer_user_id = p_actor_user_id,
        reviewer_note = nullif(trim(p_reviewer_note), ''),
        reviewed_at = timezone('utc', now())
    where id = v_po.id;

    perform public.transition_order_status(
      v_order.id, 'po_approved', p_actor_user_id,
      'Purchase order approved.',
      jsonb_build_object('purchase_order_id', v_po.id)
    );
  elsif p_decision = 'revision' then
    v_status := 'revision_requested';
    update public.purchase_orders
    set status = v_status,
        reviewer_user_id = p_actor_user_id,
        reviewer_note = nullif(trim(p_reviewer_note), ''),
        reviewed_at = timezone('utc', now())
    where id = v_po.id;

    perform public.transition_order_status(
      v_order.id, 'po_revision_requested', p_actor_user_id,
      'Purchase-order revision requested.',
      jsonb_build_object('purchase_order_id', v_po.id)
    );
  elsif p_decision = 'decline' then
    v_status := 'declined';
    update public.purchase_orders
    set status = v_status,
        reviewer_user_id = p_actor_user_id,
        reviewer_note = nullif(trim(p_reviewer_note), ''),
        reviewed_at = timezone('utc', now())
    where id = v_po.id;

    update public.agency_credit_holds
    set status = 'declined',
        released_at = timezone('utc', now()),
        note = 'Purchase order declined.'
    where order_id = v_order.id
      and status in ('active', 'approved_exception', 'pending_exception');

    perform public.transition_order_status(
      v_order.id, 'cancelled', p_actor_user_id,
      'Purchase order declined.',
      jsonb_build_object('purchase_order_id', v_po.id)
    );
  else
    raise exception 'Review decision is invalid.';
  end if;

  insert into public.audit_log (
    order_id, actor_user_id, event_key, entity_type, entity_id, metadata
  )
  values (
    v_order.id, p_actor_user_id, 'purchase_order.' || p_decision,
    'purchase_order', v_po.id::text,
    jsonb_build_object('reviewer_note', nullif(trim(p_reviewer_note), ''))
  );

  return query select v_order.id, v_order.order_number, v_status;
end;
$$;

create or replace function public.issue_invoice_for_order(
  p_order_id uuid,
  p_remittance_account_id uuid,
  p_actor_user_id uuid
)
returns table(
  invoice_id uuid,
  invoice_number text,
  invoice_total_cents bigint,
  invoice_due_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_agency public.agency_accounts%rowtype;
  v_po public.purchase_orders%rowtype;
  v_remit public.remittance_accounts%rowtype;
  v_invoice_id uuid;
  v_invoice_number text;
  v_due_date date;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found.'; end if;
  if v_order.status <> 'po_approved' then
    raise exception 'The purchase order must be approved before invoicing.';
  end if;
  if v_order.credit_status not in ('within_limit', 'exception_approved') then
    raise exception 'Approved agency credit is required before invoicing.';
  end if;
  if exists (select 1 from public.invoices where order_id = p_order_id) then
    raise exception 'An invoice already exists for this order.';
  end if;

  select * into v_agency
  from public.agency_accounts
  where id = v_order.agency_id;

  select * into v_po
  from public.purchase_orders
  where order_id = p_order_id and status = 'approved';

  if not found then raise exception 'Approved purchase order not found.'; end if;

  select * into v_remit
  from public.remittance_accounts
  where id = p_remittance_account_id and active = true;

  if not found then raise exception 'Active remittance account not found.'; end if;

  v_invoice_number := public.next_invoice_number();
  v_due_date := current_date + v_agency.payment_terms_days;

  insert into public.invoices (
    invoice_number, order_id, agency_id, purchase_order_id,
    remittance_account_id, status, invoice_date, due_date,
    pre_discount_total_cents, published_total_cents,
    campaign_discount_cents, agency_discount_cents,
    subtotal_cents, tax_cents, total_cents, paid_cents, balance_cents,
    payment_terms_days, client_snapshot, agency_snapshot, pricing_snapshot,
    remittance_snapshot, issued_by_user_id
  )
  values (
    v_invoice_number, v_order.id, v_order.agency_id, v_po.id,
    v_remit.id, 'issued', current_date, v_due_date,
    v_order.pre_discount_total_cents, v_order.published_total_cents,
    v_order.campaign_discount_applied_cents,
    v_order.agency_discount_cents, v_order.net_contract_total_cents,
    v_order.tax_cents, v_order.net_contract_total_cents + v_order.tax_cents,
    0, v_order.net_contract_total_cents + v_order.tax_cents,
    v_agency.payment_terms_days, v_order.client_snapshot,
    jsonb_build_object(
      'id', v_agency.id,
      'accountNumber', v_agency.account_number,
      'legalName', v_agency.legal_name,
      'displayName', v_agency.display_name,
      'paymentTermsDays', v_agency.payment_terms_days
    ),
    v_order.pricing_snapshot,
    jsonb_build_object(
      'id', v_remit.id,
      'displayName', v_remit.display_name,
      'bankName', v_remit.bank_name,
      'beneficiaryName', v_remit.beneficiary_name,
      'accountType', v_remit.account_type,
      'accountLast4', v_remit.account_last4,
      'remittanceEmail', v_remit.remittance_email,
      'achEnabled', v_remit.ach_enabled,
      'wireEnabled', v_remit.wire_enabled,
      'instructions', v_remit.instructions
    ),
    p_actor_user_id
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    invoice_id, order_item_id, sort_order, description, service_period,
    quantity, unit_amount_cents, line_total_cents, metadata
  )
  select
    v_invoice_id, item.id, item.sort_order,
    coalesce(item.combination_snapshot->>'screenLabel', item.sku) ||
      ' · ' || coalesce(item.combination_snapshot->>'durationSeconds', '') ||
      's ' || coalesce(item.combination_snapshot->>'formatLabel', ''),
    item.start_date::text || ' through ' || item.end_date::text,
    1, item.total_cents, item.total_cents,
    jsonb_build_object(
      'sku', item.sku,
      'combination', item.combination_snapshot,
      'pricing', item.pricing_snapshot
    )
  from public.order_items item
  where item.order_id = v_order.id
  order by item.sort_order;

  insert into public.invoice_status_history (
    invoice_id, previous_status, new_status, actor_user_id, note
  )
  values (
    v_invoice_id, null, 'issued', p_actor_user_id,
    'Invoice issued after purchase-order approval.'
  );

  insert into public.agency_credit_ledger (
    agency_id, order_id, entry_type, amount_cents, reference, note,
    created_by_user_id
  )
  values (
    v_order.agency_id, v_order.id, 'invoice',
    v_order.net_contract_total_cents + v_order.tax_cents,
    v_invoice_number, 'Invoice issued.', p_actor_user_id
  );

  update public.agency_credit_holds
  set status = 'released',
      released_at = timezone('utc', now()),
      note = 'Credit hold converted to invoice exposure.'
  where order_id = v_order.id
    and status in ('active', 'approved_exception');

  update public.orders
  set credit_status = 'hold_released'
  where id = v_order.id;

  perform public.transition_order_status(
    v_order.id, 'invoice_issued', p_actor_user_id, 'Invoice issued.',
    jsonb_build_object(
      'invoice_id', v_invoice_id,
      'invoice_number', v_invoice_number
    )
  );

  perform public.transition_order_status(
    v_order.id, 'awaiting_assets', p_actor_user_id,
    'Invoice issued; asset submission may begin.',
    jsonb_build_object(
      'invoice_id', v_invoice_id,
      'invoice_number', v_invoice_number
    )
  );

  insert into public.audit_log (
    order_id, actor_user_id, event_key, entity_type, entity_id, metadata
  )
  values (
    v_order.id, p_actor_user_id, 'invoice.issued', 'invoice',
    v_invoice_id::text,
    jsonb_build_object(
      'invoice_number', v_invoice_number,
      'total_cents', v_order.net_contract_total_cents + v_order.tax_cents,
      'due_date', v_due_date
    )
  );

  return query
  select v_invoice_id, v_invoice_number,
    v_order.net_contract_total_cents + v_order.tax_cents, v_due_date;
end;
$$;

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount_cents bigint,
  p_method public.invoice_payment_method,
  p_received_date date,
  p_reference text,
  p_note text,
  p_actor_user_id uuid
)
returns table(
  invoice_id uuid,
  invoice_number text,
  invoice_status public.invoice_status,
  paid_cents bigint,
  balance_cents bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_new_paid bigint;
  v_new_balance bigint;
  v_new_status public.invoice_status;
begin
  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then raise exception 'Invoice not found.'; end if;
  if v_invoice.status in ('void', 'written_off') then
    raise exception 'Payments cannot be recorded against this invoice.';
  end if;
  if p_amount_cents <= 0 or p_amount_cents > v_invoice.balance_cents then
    raise exception 'Payment amount must be greater than zero and no more than the open balance.';
  end if;

  insert into public.invoice_payments (
    invoice_id, agency_id, amount_cents, method, received_date,
    reference, note, recorded_by_user_id
  )
  values (
    v_invoice.id, v_invoice.agency_id, p_amount_cents, p_method,
    p_received_date, nullif(trim(p_reference), ''),
    nullif(trim(p_note), ''), p_actor_user_id
  );

  v_new_paid := v_invoice.paid_cents + p_amount_cents;
  v_new_balance := v_invoice.total_cents - v_new_paid;
  v_new_status := case when v_new_balance = 0 then 'paid' else 'partially_paid' end;

  update public.invoices
  set paid_cents = v_new_paid,
      balance_cents = v_new_balance,
      status = v_new_status
  where id = v_invoice.id;

  insert into public.invoice_status_history (
    invoice_id, previous_status, new_status, actor_user_id, note, metadata
  )
  values (
    v_invoice.id, v_invoice.status, v_new_status, p_actor_user_id,
    'Manual payment recorded.',
    jsonb_build_object(
      'amount_cents', p_amount_cents,
      'method', p_method,
      'reference', nullif(trim(p_reference), '')
    )
  );

  insert into public.agency_credit_ledger (
    agency_id, order_id, entry_type, amount_cents, reference, note,
    created_by_user_id
  )
  values (
    v_invoice.agency_id, v_invoice.order_id, 'payment', -p_amount_cents,
    coalesce(nullif(trim(p_reference), ''), v_invoice.invoice_number),
    'Invoice payment recorded.', p_actor_user_id
  );

  if v_new_balance = 0 then
    update public.orders
    set payment_status = 'succeeded',
        payment_method = case
          when p_method = 'ach' then 'ach'::public.payment_method
          when p_method = 'wire' then 'wire'::public.payment_method
          else payment_method
        end,
        payment_reference = coalesce(
          nullif(trim(p_reference), ''), v_invoice.invoice_number
        )
    where id = v_invoice.order_id;
  else
    update public.orders
    set payment_status = 'processing'
    where id = v_invoice.order_id;
  end if;

  insert into public.audit_log (
    order_id, actor_user_id, event_key, entity_type, entity_id, metadata
  )
  values (
    v_invoice.order_id, p_actor_user_id, 'invoice.payment_recorded',
    'invoice', v_invoice.id::text,
    jsonb_build_object(
      'invoice_number', v_invoice.invoice_number,
      'amount_cents', p_amount_cents,
      'remaining_balance_cents', v_new_balance,
      'method', p_method
    )
  );

  return query
  select v_invoice.id, v_invoice.invoice_number, v_new_status,
    v_new_paid, v_new_balance;
end;
$$;

alter table public.remittance_accounts enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_documents enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.invoice_status_history enable row level security;

revoke all on table public.remittance_accounts from anon, authenticated;
revoke all on table public.purchase_orders from anon, authenticated;
revoke all on table public.purchase_order_documents from anon, authenticated;
revoke all on table public.invoices from anon, authenticated;
revoke all on table public.invoice_items from anon, authenticated;
revoke all on table public.invoice_payments from anon, authenticated;
revoke all on table public.invoice_status_history from anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.remittance_accounts to service_role;
grant all on table public.purchase_orders to service_role;
grant all on table public.purchase_order_documents to service_role;
grant all on table public.invoices to service_role;
grant all on table public.invoice_items to service_role;
grant all on table public.invoice_payments to service_role;
grant all on table public.invoice_status_history to service_role;
grant usage, select on sequence public.invoice_number_seq to service_role;

revoke all on function public.next_invoice_number() from public, anon, authenticated;
revoke all on function public.create_remittance_account(
  text, text, text, text, text, text, text, boolean, boolean, text, uuid
) from public, anon, authenticated;
revoke all on function public.get_remittance_account_secure(uuid)
  from public, anon, authenticated;
revoke all on function public.submit_agency_purchase_order(
  uuid, text, date, text, text, text, text, bigint, uuid
) from public, anon, authenticated;
revoke all on function public.review_purchase_order(uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.issue_invoice_for_order(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.record_invoice_payment(
  uuid, bigint, public.invoice_payment_method, date, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.next_invoice_number() to service_role;
grant execute on function public.create_remittance_account(
  text, text, text, text, text, text, text, boolean, boolean, text, uuid
) to service_role;
grant execute on function public.get_remittance_account_secure(uuid)
  to service_role;
grant execute on function public.submit_agency_purchase_order(
  uuid, text, date, text, text, text, text, bigint, uuid
) to service_role;
grant execute on function public.review_purchase_order(uuid, text, text, uuid)
  to service_role;
grant execute on function public.issue_invoice_for_order(uuid, uuid, uuid)
  to service_role;
grant execute on function public.record_invoice_payment(
  uuid, bigint, public.invoice_payment_method, date, text, text, uuid
) to service_role;

commit;
