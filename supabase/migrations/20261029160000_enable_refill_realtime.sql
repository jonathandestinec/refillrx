-- Keep already-open patient and pharmacist dashboards in sync with refill changes.
alter table if exists public.refill_orders replica identity full;
alter table if exists public.refill_order_messages replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.refill_orders;
exception
  when duplicate_object then null;
  when undefined_object then null;
  when undefined_table then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.refill_order_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
  when undefined_table then null;
end $$;
