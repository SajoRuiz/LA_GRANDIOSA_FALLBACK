-- La Grandiosa Commerce — Stage 3B-B
-- Negotiated agency pricing, credit exposure, credit holds, exception review,
-- agency credit ledger, portal credit summaries, and finance administration.

begin;

-- ------------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------------
do $$
begin
  create type public.agency_credit_status as enum (
    'not_checked',
    'within_limit',
    'review_required',
    'exception_approved',
    'exception_declined',
    'hold_released'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.agency_credit_hold_status as enum (
    'active',
    'pending_exception',
    'approved_exception',
    'released',
    'declined',
    'expired',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.agency_credit_review_status as enum (
    'pending',
    'approved',
    'declined',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.agency_credit_ledger_entry_type as enum (
    'opening_balance',
    'invoice',
    'payment',
    'credit_memo',
    'debit_adjustment',
    'credit_adjustment',
    'write_off'
  );
exception
  when duplicate_object then null;
end $$;

-- ------------------------------------------------------------------
-- Order pricing and credit snapshots
-- ------------------------------------------------------------------
alter table public.orders
  add column if not exists pre_discount_total_cents bigint not null default 0
    check (pre_discount_total_cents >= 0),
  add column if not exists published_total_cents bigint not null default 0
    check (published_total_cents >= 0),
  add column if not exists agency_discount_base_cents bigint not null default 0
    check (agency_discount_base_cents >= 0),
  add column if not exists campaign_discount_applied_cents bigint not null default 0
    check (campaign_discount_applied_cents >= 0),
  add column if not exists agency_discount_basis_points integer not null default 0
    check (agency_discount_basis_points between 0 and 10000),
  add column if not exists agency_discount_policy public.discount_policy,
  add column if not exists agency_discount_cents bigint not null default 0
    check (agency_discount_cents >= 0),
  add column if not exists net_contract_total_cents bigint not null default 0
    check (net_contract_total_cents >= 0),
  add column if not exists credit_status public.agency_credit_status not null default 'not_checked',
  add column if not exists credit_snapshot jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------------
-- Credit holds, reviews, and ledger
-- ------------------------------------------------------------------
create table if not exists public.agency_credit_holds (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency_accounts(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  status public.agency_credit_hold_status not null,
  held_until timestamptz,
  approved_by_user_id uuid references auth.users(id),
  approved_at timestamptz,
  released_at timestamptz,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists agency_credit_holds_agency_status_idx
  on public.agency_credit_holds (agency_id, status, created_at desc);
create index if not exists agency_credit_holds_held_until_idx
  on public.agency_credit_holds (held_until)
  where status in ('active', 'pending_exception', 'approved_exception');

create table if not exists public.agency_credit_reviews (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency_accounts(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  credit_hold_id uuid not null unique references public.agency_credit_holds(id) on delete cascade,
  requested_amount_cents bigint not null check (requested_amount_cents >= 0),
  available_credit_cents bigint not null check (available_credit_cents >= 0),
  shortfall_cents bigint not null check (shortfall_cents >= 0),
  status public.agency_credit_review_status not null default 'pending',
  reviewer_user_id uuid references auth.users(id),
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists agency_credit_reviews_status_idx
  on public.agency_credit_reviews (status, created_at desc);
create index if not exists agency_credit_reviews_agency_idx
  on public.agency_credit_reviews (agency_id, created_at desc);

create table if not exists public.agency_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency_accounts(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  entry_type public.agency_credit_ledger_entry_type not null,
  amount_cents bigint not null check (amount_cents <> 0),
  reference text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  effective_at timestamptz not null default timezone('utc', now()),
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists agency_credit_ledger_agency_effective_idx
  on public.agency_credit_ledger (agency_id, effective_at desc);
create index if not exists agency_credit_ledger_order_idx
  on public.agency_credit_ledger (order_id)
  where order_id is not null;

alter table public.orders
  add column if not exists credit_hold_id uuid references public.agency_credit_holds(id);

-- ------------------------------------------------------------------
-- Updated-at triggers
-- ------------------------------------------------------------------
drop trigger if exists agency_credit_holds_set_updated_at on public.agency_credit_holds;
create trigger agency_credit_holds_set_updated_at
before update on public.agency_credit_holds
for each row execute function public.set_updated_at();

drop trigger if exists agency_credit_reviews_set_updated_at on public.agency_credit_reviews;
create trigger agency_credit_reviews_set_updated_at
before update on public.agency_credit_reviews
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- Credit summary
-- Positive ledger entries increase exposure; negative entries reduce it.
-- ------------------------------------------------------------------
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

  select approved_credit_limit_cents
  into v_limit
  from public.agency_accounts
  where id = p_agency_id;

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

-- ------------------------------------------------------------------
-- Finance functions
-- ------------------------------------------------------------------
create or replace function public.resolve_agency_credit_review(
  p_review_id uuid,
  p_approve boolean,
  p_reviewer_note text,
  p_actor_user_id uuid
)
returns table(
  order_id uuid,
  order_number text,
  credit_status public.agency_credit_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.agency_credit_reviews%rowtype;
  v_order public.orders%rowtype;
  v_new_credit_status public.agency_credit_status;
  v_hold_status public.agency_credit_hold_status;
begin
  select *
  into v_review
  from public.agency_credit_reviews
  where id = p_review_id
  for update;

  if not found then
    raise exception 'Credit review not found.';
  end if;

  if v_review.status <> 'pending' then
    raise exception 'Credit review is no longer pending.';
  end if;

  select *
  into v_order
  from public.orders
  where id = v_review.order_id
  for update;

  if p_approve then
    v_new_credit_status := 'exception_approved';
    v_hold_status := 'approved_exception';

    update public.agency_credit_reviews
    set
      status = 'approved',
      reviewer_user_id = p_actor_user_id,
      reviewer_note = nullif(trim(p_reviewer_note), ''),
      reviewed_at = timezone('utc', now())
    where id = v_review.id;

    update public.agency_credit_holds
    set
      status = v_hold_status,
      approved_by_user_id = p_actor_user_id,
      approved_at = timezone('utc', now()),
      note = nullif(trim(p_reviewer_note), '')
    where id = v_review.credit_hold_id;
  else
    v_new_credit_status := 'exception_declined';
    v_hold_status := 'declined';

    update public.agency_credit_reviews
    set
      status = 'declined',
      reviewer_user_id = p_actor_user_id,
      reviewer_note = nullif(trim(p_reviewer_note), ''),
      reviewed_at = timezone('utc', now())
    where id = v_review.id;

    update public.agency_credit_holds
    set
      status = v_hold_status,
      released_at = timezone('utc', now()),
      note = nullif(trim(p_reviewer_note), '')
    where id = v_review.credit_hold_id;
  end if;

  update public.orders
  set credit_status = v_new_credit_status
  where id = v_review.order_id;

  insert into public.audit_log (
    order_id,
    actor_user_id,
    event_key,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_review.order_id,
    p_actor_user_id,
    case when p_approve
      then 'credit.exception_approved'
      else 'credit.exception_declined'
    end,
    'agency_credit_review',
    v_review.id::text,
    jsonb_build_object(
      'agency_id', v_review.agency_id,
      'shortfall_cents', v_review.shortfall_cents,
      'reviewer_note', nullif(trim(p_reviewer_note), '')
    )
  );

  insert into public.agency_account_history (
    agency_id,
    actor_user_id,
    event_key,
    metadata
  )
  values (
    v_review.agency_id,
    p_actor_user_id,
    case when p_approve
      then 'agency.credit_exception_approved'
      else 'agency.credit_exception_declined'
    end,
    jsonb_build_object(
      'order_id', v_review.order_id,
      'order_number', v_order.order_number,
      'amount_cents', v_review.requested_amount_cents,
      'shortfall_cents', v_review.shortfall_cents
    )
  );

  return query
  select v_order.id, v_order.order_number, v_new_credit_status;
end;
$$;

create or replace function public.record_agency_credit_ledger_entry(
  p_agency_id uuid,
  p_entry_type public.agency_credit_ledger_entry_type,
  p_amount_cents bigint,
  p_reference text,
  p_note text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
begin
  if p_amount_cents = 0 then
    raise exception 'Credit ledger amount cannot be zero.';
  end if;

  insert into public.agency_credit_ledger (
    agency_id,
    entry_type,
    amount_cents,
    reference,
    note,
    created_by_user_id
  )
  values (
    p_agency_id,
    p_entry_type,
    p_amount_cents,
    nullif(trim(p_reference), ''),
    nullif(trim(p_note), ''),
    p_actor_user_id
  )
  returning id into v_entry_id;

  insert into public.agency_account_history (
    agency_id,
    actor_user_id,
    event_key,
    metadata
  )
  values (
    p_agency_id,
    p_actor_user_id,
    'agency.credit_ledger_entry_created',
    jsonb_build_object(
      'entry_id', v_entry_id,
      'entry_type', p_entry_type,
      'amount_cents', p_amount_cents,
      'reference', nullif(trim(p_reference), '')
    )
  );

  return v_entry_id;
end;
$$;

-- ------------------------------------------------------------------
-- Replace agency draft creation with pricing and credit controls.
-- The server supplies campaign pricing; agency discount terms are read from
-- the locked agency account row inside this transaction.
-- ------------------------------------------------------------------
drop function if exists public.create_agency_order_draft(jsonb, jsonb, jsonb, jsonb);

create function public.create_agency_order_draft(
  p_client jsonb,
  p_order jsonb,
  p_items jsonb,
  p_notifications jsonb default '[]'::jsonb
)
returns table(
  order_id uuid,
  order_number text,
  credit_status public.agency_credit_status,
  credit_hold_id uuid,
  available_credit_before_cents bigint,
  available_credit_after_cents bigint,
  credit_shortfall_cents bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_client_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_agency_id uuid;
  v_ordered_by_user_id uuid;
  v_agency public.agency_accounts%rowtype;
  v_pre_discount_total bigint;
  v_campaign_discount_available bigint;
  v_campaign_discount_applied bigint;
  v_public_published_total bigint;
  v_agency_discount_base bigint;
  v_agency_discount_candidate bigint;
  v_agency_discount bigint;
  v_net_total bigint;
  v_credit_summary record;
  v_credit_status public.agency_credit_status;
  v_credit_hold_status public.agency_credit_hold_status;
  v_credit_hold_id uuid;
  v_available_after bigint;
  v_shortfall bigint;
  v_review_id uuid;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one order item is required.';
  end if;

  v_agency_id := nullif(p_order->>'agency_id', '')::uuid;
  v_ordered_by_user_id := nullif(p_order->>'ordered_by_user_id', '')::uuid;

  if v_agency_id is null or v_ordered_by_user_id is null then
    raise exception 'Agency and authenticated purchaser are required.';
  end if;

  select *
  into v_agency
  from public.agency_accounts
  where id = v_agency_id
  for update;

  if not found
     or v_agency.status <> 'active'
     or v_agency.effective_date > current_date
     or (v_agency.expires_at is not null and v_agency.expires_at < current_date) then
    raise exception 'Agency account is not active.';
  end if;

  if not exists (
    select 1
    from public.agency_members member
    where member.agency_id = v_agency_id
      and member.user_id = v_ordered_by_user_id
      and member.status = 'active'
      and member.can_purchase = true
  ) then
    raise exception 'The authenticated user is not authorized to purchase for this agency.';
  end if;

  v_pre_discount_total := greatest(
    coalesce((p_order->>'pre_discount_total_cents')::bigint, 0),
    0
  );
  v_campaign_discount_available := greatest(
    coalesce((p_order->>'campaign_discount_available_cents')::bigint, 0),
    0
  );

  if v_campaign_discount_available > v_pre_discount_total then
    raise exception 'Campaign discount exceeds the pre-discount total.';
  end if;

  v_public_published_total :=
    v_pre_discount_total - v_campaign_discount_available;
  v_agency_discount_candidate := round(
    v_pre_discount_total * v_agency.discount_basis_points::numeric / 10000
  );

  if v_agency.discount_policy = 'stack' then
    v_campaign_discount_applied := v_campaign_discount_available;
    v_agency_discount_base := v_public_published_total;
    v_agency_discount := round(
      v_agency_discount_base * v_agency.discount_basis_points::numeric / 10000
    );
  elsif v_agency.discount_policy = 'best_of' then
    if v_agency_discount_candidate > v_campaign_discount_available then
      v_campaign_discount_applied := 0;
      v_agency_discount_base := v_pre_discount_total;
      v_agency_discount := v_agency_discount_candidate;
    else
      v_campaign_discount_applied := v_campaign_discount_available;
      v_agency_discount_base := v_public_published_total;
      v_agency_discount := 0;
    end if;
  else
    v_campaign_discount_applied := 0;
    v_agency_discount_base := v_pre_discount_total;
    v_agency_discount := v_agency_discount_candidate;
  end if;

  v_net_total := greatest(v_agency_discount_base - v_agency_discount, 0);

  select *
  into v_credit_summary
  from public.get_agency_credit_summary(v_agency_id);

  if v_net_total <= v_credit_summary.available_credit_cents then
    v_credit_status := 'within_limit';
    v_credit_hold_status := 'active';
    v_available_after := v_credit_summary.available_credit_cents - v_net_total;
    v_shortfall := 0;
  else
    v_credit_status := 'review_required';
    v_credit_hold_status := 'pending_exception';
    v_available_after := v_credit_summary.available_credit_cents;
    v_shortfall := v_net_total - v_credit_summary.available_credit_cents;
  end if;

  select id
  into v_client_id
  from public.client_contacts
  where agency_id = v_agency_id
    and lower(email) = lower(p_client->>'email')
  order by updated_at desc
  limit 1;

  if v_client_id is null then
    insert into public.client_contacts (
      agency_id,
      full_name,
      email,
      telephone,
      address_line_1,
      address_line_2,
      city,
      region,
      postal_code,
      country,
      company_name,
      agency_name,
      campaign_name,
      purchase_order_number,
      sms_transactional_consent
    )
    values (
      v_agency_id,
      p_client->>'full_name',
      lower(p_client->>'email'),
      p_client->>'telephone',
      p_client->>'address_line_1',
      nullif(p_client->>'address_line_2', ''),
      p_client->>'city',
      p_client->>'region',
      p_client->>'postal_code',
      p_client->>'country',
      nullif(p_client->>'company_name', ''),
      nullif(p_client->>'agency_name', ''),
      nullif(p_client->>'campaign_name', ''),
      nullif(p_client->>'purchase_order_number', ''),
      coalesce((p_client->>'sms_transactional_consent')::boolean, false)
    )
    returning id into v_client_id;
  else
    update public.client_contacts
    set
      full_name = p_client->>'full_name',
      telephone = p_client->>'telephone',
      address_line_1 = p_client->>'address_line_1',
      address_line_2 = nullif(p_client->>'address_line_2', ''),
      city = p_client->>'city',
      region = p_client->>'region',
      postal_code = p_client->>'postal_code',
      country = p_client->>'country',
      company_name = nullif(p_client->>'company_name', ''),
      agency_name = nullif(p_client->>'agency_name', ''),
      campaign_name = nullif(p_client->>'campaign_name', ''),
      purchase_order_number = nullif(p_client->>'purchase_order_number', ''),
      sms_transactional_consent = coalesce(
        (p_client->>'sms_transactional_consent')::boolean,
        false
      )
    where id = v_client_id;
  end if;

  v_order_number := public.next_order_number();

  insert into public.orders (
    order_number,
    client_contact_id,
    agency_id,
    ordered_by_user_id,
    status,
    currency,
    gross_media_subtotal_cents,
    closed_holiday_deduction_cents,
    adjusted_media_subtotal_cents,
    date_selection_premium_cents,
    multi_month_discount_cents,
    tax_cents,
    total_cents,
    pre_discount_total_cents,
    published_total_cents,
    agency_discount_base_cents,
    campaign_discount_applied_cents,
    agency_discount_basis_points,
    agency_discount_policy,
    agency_discount_cents,
    net_contract_total_cents,
    credit_status,
    client_snapshot,
    pricing_snapshot,
    credit_snapshot,
    source
  )
  values (
    v_order_number,
    v_client_id,
    v_agency_id,
    v_ordered_by_user_id,
    'client_information_received',
    coalesce(p_order->>'currency', 'USD'),
    coalesce((p_order->>'gross_media_subtotal_cents')::bigint, 0),
    coalesce((p_order->>'closed_holiday_deduction_cents')::bigint, 0),
    coalesce((p_order->>'adjusted_media_subtotal_cents')::bigint, 0),
    coalesce((p_order->>'date_selection_premium_cents')::bigint, 0),
    v_campaign_discount_available,
    coalesce((p_order->>'tax_cents')::bigint, 0),
    v_net_total,
    v_pre_discount_total,
    v_public_published_total,
    v_agency_discount_base,
    v_campaign_discount_applied,
    v_agency.discount_basis_points,
    v_agency.discount_policy,
    v_agency_discount,
    v_net_total,
    v_credit_status,
    p_client,
    coalesce(p_order->'pricing_snapshot', '{}'::jsonb) || jsonb_build_object(
      'agencyPricing', jsonb_build_object(
        'discountPolicy', v_agency.discount_policy,
        'discountBasisPoints', v_agency.discount_basis_points,
        'preDiscountTotalCents', v_pre_discount_total,
        'campaignDiscountAvailableCents', v_campaign_discount_available,
        'campaignDiscountAppliedCents', v_campaign_discount_applied,
        'publicPublishedTotalCents', v_public_published_total,
        'agencyDiscountBaseCents', v_agency_discount_base,
        'agencyDiscountCents', v_agency_discount,
        'netContractTotalCents', v_net_total
      )
    ),
    jsonb_build_object(
      'approvedCreditLimitCents', v_credit_summary.approved_credit_limit_cents,
      'ledgerExposureCents', v_credit_summary.ledger_exposure_cents,
      'activeHoldExposureCents', v_credit_summary.active_hold_exposure_cents,
      'availableCreditBeforeCents', v_credit_summary.available_credit_cents,
      'availableCreditAfterCents', v_available_after,
      'shortfallCents', v_shortfall,
      'status', v_credit_status
    ),
    coalesce(p_order->>'source', 'agency_portal')
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    cart_item_id,
    sort_order,
    sku,
    start_date,
    end_date,
    combination_snapshot,
    pricing_snapshot,
    total_cents
  )
  select
    v_order_id,
    item->>'cart_item_id',
    coalesce((item->>'sort_order')::integer, 0),
    item->>'sku',
    (item->>'start_date')::date,
    (item->>'end_date')::date,
    item->'combination_snapshot',
    item->'pricing_snapshot',
    (item->>'total_cents')::bigint
  from jsonb_array_elements(p_items) as item;

  insert into public.agency_credit_holds (
    agency_id,
    order_id,
    amount_cents,
    status,
    held_until,
    note
  )
  values (
    v_agency_id,
    v_order_id,
    v_net_total,
    v_credit_hold_status,
    timezone('utc', now()) + interval '7 days',
    case when v_credit_status = 'within_limit'
      then 'Automatic credit hold within approved limit.'
      else 'Pending finance exception review.'
    end
  )
  returning id into v_credit_hold_id;

  update public.orders
  set credit_hold_id = v_credit_hold_id
  where id = v_order_id;

  if v_credit_status = 'review_required' then
    insert into public.agency_credit_reviews (
      agency_id,
      order_id,
      credit_hold_id,
      requested_amount_cents,
      available_credit_cents,
      shortfall_cents
    )
    values (
      v_agency_id,
      v_order_id,
      v_credit_hold_id,
      v_net_total,
      v_credit_summary.available_credit_cents,
      v_shortfall
    )
    returning id into v_review_id;
  end if;

  insert into public.order_status_history (
    order_id,
    previous_status,
    new_status,
    actor_user_id,
    note,
    metadata
  )
  values (
    v_order_id,
    null,
    'client_information_received',
    v_ordered_by_user_id,
    'Agency client information received with negotiated pricing and credit validation.',
    jsonb_build_object(
      'source', 'agency_portal',
      'agency_id', v_agency_id,
      'credit_status', v_credit_status,
      'credit_hold_id', v_credit_hold_id,
      'credit_review_id', v_review_id
    )
  );

  insert into public.audit_log (
    order_id,
    actor_user_id,
    event_key,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_order_id,
    v_ordered_by_user_id,
    'order.agency_pricing_and_credit_checked',
    'order',
    v_order_id::text,
    jsonb_build_object(
      'order_number', v_order_number,
      'agency_id', v_agency_id,
      'published_total_cents', v_public_published_total,
      'agency_discount_cents', v_agency_discount,
      'net_contract_total_cents', v_net_total,
      'credit_status', v_credit_status,
      'shortfall_cents', v_shortfall
    )
  );

  insert into public.notification_outbox (
    order_id,
    channel,
    template_key,
    recipient,
    sender_email,
    reply_to_email,
    payload,
    dedupe_key
  )
  select
    v_order_id,
    (notification->>'channel')::public.notification_channel,
    notification->>'template_key',
    notification->>'recipient',
    nullif(notification->>'sender_email', ''),
    nullif(notification->>'reply_to_email', ''),
    coalesce(notification->'payload', '{}'::jsonb) || jsonb_build_object(
      'orderId', v_order_id,
      'orderNumber', v_order_number,
      'creditStatus', v_credit_status,
      'publicPublishedTotalCents', v_public_published_total,
        'agencyDiscountBaseCents', v_agency_discount_base,
      'agencyDiscountCents', v_agency_discount,
      'netContractTotalCents', v_net_total,
      'creditShortfallCents', v_shortfall
    ),
    notification->>'dedupe_key'
  from jsonb_array_elements(p_notifications) as notification
  on conflict (dedupe_key) do nothing;

  return query
  select
    v_order_id,
    v_order_number,
    v_credit_status,
    v_credit_hold_id,
    v_credit_summary.available_credit_cents,
    v_available_after,
    v_shortfall;
end;
$$;

-- ------------------------------------------------------------------
-- RLS and grants
-- ------------------------------------------------------------------
alter table public.agency_credit_holds enable row level security;
alter table public.agency_credit_reviews enable row level security;
alter table public.agency_credit_ledger enable row level security;

drop policy if exists agency_credit_holds_select_member_or_staff on public.agency_credit_holds;
drop policy if exists agency_credit_reviews_select_member_or_staff on public.agency_credit_reviews;
drop policy if exists agency_credit_ledger_select_member_or_staff on public.agency_credit_ledger;

create policy agency_credit_holds_select_member_or_staff
on public.agency_credit_holds
for select
to authenticated
using (
  public.session_is_aal2()
  and (
    public.is_active_agency_member(agency_id)
    or public.is_active_staff(null)
  )
);

create policy agency_credit_reviews_select_member_or_staff
on public.agency_credit_reviews
for select
to authenticated
using (
  public.session_is_aal2()
  and (
    public.is_active_agency_member(agency_id)
    or public.is_active_staff(null)
  )
);

create policy agency_credit_ledger_select_member_or_staff
on public.agency_credit_ledger
for select
to authenticated
using (
  public.session_is_aal2()
  and (
    public.is_active_agency_member(agency_id)
    or public.is_active_staff(null)
  )
);

grant select on public.agency_credit_holds to authenticated;
grant select on public.agency_credit_reviews to authenticated;
grant select on public.agency_credit_ledger to authenticated;
grant execute on function public.get_agency_credit_summary(uuid) to authenticated;

revoke all on function public.resolve_agency_credit_review(uuid, boolean, text, uuid)
  from public, anon, authenticated;
revoke all on function public.record_agency_credit_ledger_entry(uuid, public.agency_credit_ledger_entry_type, bigint, text, text, uuid)
  from public, anon, authenticated;

-- Explicit service-role Data API grants. RLS bypass is not a substitute for
-- PostgreSQL table privileges.
grant usage on schema public to service_role;
grant select, insert, update, delete
on table
  public.user_profiles,
  public.agency_accounts,
  public.agency_members,
  public.staff_members,
  public.agency_invites,
  public.agency_account_history,
  public.agency_credit_holds,
  public.agency_credit_reviews,
  public.agency_credit_ledger,
  public.client_contacts,
  public.orders,
  public.order_items,
  public.order_status_history,
  public.audit_log,
  public.notification_outbox,
  public.inventory_holds
to service_role;

grant usage, select on sequence public.agency_account_number_seq to service_role;
grant usage, select on sequence public.order_number_seq to service_role;
grant execute on function public.get_agency_credit_summary(uuid) to service_role;
grant execute on function public.resolve_agency_credit_review(uuid, boolean, text, uuid) to service_role;
grant execute on function public.record_agency_credit_ledger_entry(uuid, public.agency_credit_ledger_entry_type, bigint, text, text, uuid) to service_role;
grant execute on function public.create_agency_order_draft(jsonb, jsonb, jsonb, jsonb) to service_role;

commit;

-- Verification
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'agency_credit_holds',
    'agency_credit_reviews',
    'agency_credit_ledger'
  )
order by table_name;
