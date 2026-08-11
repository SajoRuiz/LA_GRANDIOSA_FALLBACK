-- Stage 7: allow API-provider intermediary states in release queue.

do $$
begin
  alter type public.release_queue_status add value if not exists 'submitted';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type public.release_queue_status add value if not exists 'acknowledged';
exception
  when duplicate_object then null;
end $$;
