create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  refill_plan_id uuid references public.refill_plans(id) on delete cascade,
  type text not null check (type in ('refill_reminder', 'order_update', 'new_message')),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'failed')),
  created_at timestamptz not null default timezone('utc', now())
);

-- Repair an existing notifications table created by an earlier schema.
alter table public.notifications
  add column if not exists refill_plan_id uuid,
  add column if not exists scheduled_for timestamptz default timezone('utc', now()),
  add column if not exists status text default 'scheduled';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notifications_refill_plan_id_fkey'
  ) then
    alter table public.notifications
      add constraint notifications_refill_plan_id_fkey
      foreign key (refill_plan_id) references public.refill_plans(id) on delete cascade not valid;
  end if;
end $$;

create unique index if not exists notifications_refill_reminder_unique
  on public.notifications (refill_plan_id, type)
  where type = 'refill_reminder';

create index if not exists notifications_patient_idx
  on public.notifications (patient_id, scheduled_for);

alter table public.notifications enable row level security;

drop policy if exists "Patients can view their notifications" on public.notifications;
create policy "Patients can view their notifications"
  on public.notifications for select
  using (patient_id = auth.uid());
