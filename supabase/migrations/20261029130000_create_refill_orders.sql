-- Superseded: refill_orders is created with its final shape, RLS, and indexes
-- by 20261028163028_create_refillrx_core_schema.sql, which reproduces the
-- originally deployed migrations (create_refillrx_core_schema + order fixes).
--
-- Kept for migration-history continuity. Everything below is idempotent and
-- cannot diverge a fresh project that applied the core schema first.

alter table public.refill_orders
  add column if not exists requested_for date,
  add column if not exists requested_at timestamptz not null default timezone('utc', now()),
  add column if not exists ready_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'refill_orders_medicine_id_fkey'
  ) then
    alter table public.refill_orders
      add constraint refill_orders_medicine_id_fkey
      foreign key (medicine_id) references public.medicines(id) on delete restrict not valid;
  end if;
end $$;

create index if not exists refill_orders_queue_idx
  on public.refill_orders (status, requested_for, requested_at);

create index if not exists refill_orders_patient_idx
  on public.refill_orders (patient_id, requested_at desc);
