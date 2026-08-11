create table if not exists public.led_provider_simulations (
  external_reference text primary key,
  provider_key text not null default 'simulated_led_provider',
  release_id uuid,
  order_id uuid,
  status public.release_queue_status not null default 'submitted',
  request_payload jsonb not null default '{}'::jsonb,
  status_payload jsonb not null default '{}'::jsonb,
  message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists led_provider_simulations_status_idx
  on public.led_provider_simulations (status, updated_at desc);

drop trigger if exists led_provider_simulations_set_updated_at
  on public.led_provider_simulations;
create trigger led_provider_simulations_set_updated_at
before update on public.led_provider_simulations
for each row execute function public.set_updated_at();

alter table public.led_provider_simulations enable row level security;

revoke all on table public.led_provider_simulations from anon, authenticated;
grant all on table public.led_provider_simulations to service_role;