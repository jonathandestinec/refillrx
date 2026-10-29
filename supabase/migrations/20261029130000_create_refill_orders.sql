create table if not exists public.refill_orders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.refill_plans(id) on delete restrict,
  medicine_id uuid not null references public.medicines(id) on delete restrict,
  status text not null default 'requested' check (status in ('requested', 'reviewing', 'ready', 'completed', 'cancelled')),
  patient_note text,
  pharmacist_note text,
  requested_for date not null,
  requested_at timestamptz not null default timezone('utc', now()),
  ready_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

-- The table may already exist if a previous run stopped after CREATE TABLE.
-- Add the scheduling column before creating its index, then backfill any
-- rows that predate it from their request timestamp.
alter table public.refill_orders
  add column if not exists requested_for date;

alter table public.refill_orders
  add column if not exists patient_id uuid,
  add column if not exists plan_id uuid,
  add column if not exists medicine_id uuid,
  add column if not exists status text default 'requested',
  add column if not exists patient_note text,
  add column if not exists pharmacist_note text,
  add column if not exists requested_at timestamptz default timezone('utc', now()),
  add column if not exists ready_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz default timezone('utc', now());

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

update public.refill_orders
set requested_for = coalesce(requested_for, requested_at::date, current_date)
where requested_for is null;

alter table public.refill_orders
  alter column requested_for set default current_date,
  alter column requested_for set not null;

create index if not exists refill_orders_queue_idx
  on public.refill_orders (status, requested_for, requested_at);

create index if not exists refill_orders_patient_idx
  on public.refill_orders (patient_id, requested_at desc);

alter table public.refill_orders enable row level security;

drop policy if exists "Patients can view their refill orders" on public.refill_orders;
create policy "Patients can view their refill orders"
  on public.refill_orders for select
  using (patient_id = auth.uid());

drop policy if exists "Patients can request their own refills" on public.refill_orders;
create policy "Patients can request their own refills"
  on public.refill_orders for insert
  with check (patient_id = auth.uid());

drop policy if exists "Pharmacists can view refill orders" on public.refill_orders;
create policy "Pharmacists can view refill orders"
  on public.refill_orders for select
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'pharmacist'
  ));

drop policy if exists "Pharmacists can update refill orders" on public.refill_orders;
create policy "Pharmacists can update refill orders"
  on public.refill_orders for update
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'pharmacist'
  ))
  with check (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'pharmacist'
  ));
