create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (patient_id, endpoint)
);

create index if not exists push_subscriptions_patient_idx
  on public.push_subscriptions (patient_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Patients can manage their push subscriptions" on public.push_subscriptions;
create policy "Patients can manage their push subscriptions"
  on public.push_subscriptions for all
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());
