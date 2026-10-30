-- Reconstructed core schema for RefillRx.
-- This mirrors the schema deployed via the Supabase migration history
-- (create_refillrx_core_schema, harden_schema_functions, add_medicine_pack_size,
-- add_refill_plan_drafts, add_draft_id_to_refill_plans). A fresh Supabase
-- project that applies this file reaches the same state as the live project.

-- 1. Enum types ------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_type t where t.typname = 'app_role') then
    create type public.app_role as enum ('patient', 'pharmacist');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t where t.typname = 'plan_status') then
    create type public.plan_status as enum ('active', 'paused', 'expired');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t where t.typname = 'order_status') then
    create type public.order_status as enum ('requested', 'reviewing', 'ready', 'completed', 'cancelled');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t where t.typname = 'payment_kind') then
    create type public.payment_kind as enum ('monthly_plan', 'one_time_refill');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t where t.typname = 'payment_status') then
    create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'expired', 'refunded');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t where t.typname = 'notification_type') then
    create type public.notification_type as enum ('refill_reminder', 'plan_expired', 'order_update', 'message');
  end if;
end $$;

-- 2. Helper functions ------------------------------------------------------

create or replace function public.set_updated_at() returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_pharmacist() returns boolean
language sql
stable
set search_path to 'public'
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacist', false);
$$;

-- Creates a profile row for every new auth user; the app relies on this.
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Profiles --------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'patient',
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles_insert_self_as_patient" on public.profiles;
create policy "profiles_insert_self_as_patient" on public.profiles for insert
  with check (auth.uid() = id and role = 'patient');

-- The pharmacist workspace must display patient details (queue, messages,
-- history). Patients remain limited to their own profile.
drop policy if exists "profiles_pharmacist_read" on public.profiles;
create policy "profiles_pharmacist_read" on public.profiles for select
  using (is_pharmacist());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id and role = 'patient');

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- 4. Pharmacy settings -----------------------------------------------------

create table if not exists public.pharmacy_settings (
  id boolean primary key default true,
  name text not null default 'Mani',
  city text not null default 'Benin City',
  address text,
  phone text,
  whatsapp text,
  opening_hours jsonb not null default '{}'::jsonb,
  monthly_service_fee_amount numeric not null default 5.00,
  monthly_service_fee_currency text not null default 'USD',
  updated_at timestamptz not null default now()
);

alter table public.pharmacy_settings enable row level security;

drop policy if exists "pharmacy_settings_read" on public.pharmacy_settings;
create policy "pharmacy_settings_read" on public.pharmacy_settings for select using (true);

drop policy if exists "pharmacy_settings_manage" on public.pharmacy_settings;
create policy "pharmacy_settings_manage" on public.pharmacy_settings for update using (is_pharmacist()) with check (is_pharmacist());

create trigger pharmacy_settings_set_updated_at before update on public.pharmacy_settings
  for each row execute function public.set_updated_at();

-- 5. Medicines --------------------------------------------------------------

create table if not exists public.medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  category text,
  dosage_form text,
  strength text,
  pack_size text,
  -- Pharmacist-only reference price used to prefill order review; patients
  -- never see it until the pharmacist confirms a price on their order.
  reference_price_ngn numeric(10,2) check (reference_price_ngn >= 0),
  requires_prescription boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.medicines enable row level security;

drop policy if exists "medicines_read_active" on public.medicines;
create policy "medicines_read_active" on public.medicines for select using (active or is_pharmacist());

drop policy if exists "medicines_manage_pharmacist" on public.medicines;
create policy "medicines_manage_pharmacist" on public.medicines for all using (is_pharmacist()) with check (is_pharmacist());

create trigger medicines_set_updated_at before update on public.medicines
  for each row execute function public.set_updated_at();

-- 6. Refill plans -----------------------------------------------------------

create table if not exists public.refill_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id),
  instructions text,
  frequency_days integer not null check (frequency_days > 0),
  next_refill_date date not null,
  reminder_days integer not null default 3 check (reminder_days >= 1 and reminder_days <= 30),
  status public.plan_status not null default 'active',
  draft_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.refill_plans enable row level security;

drop policy if exists "plans_patient_read" on public.refill_plans;
create policy "plans_patient_read" on public.refill_plans for select
  using (auth.uid() = patient_id or is_pharmacist());

drop policy if exists "plans_patient_create" on public.refill_plans;
create policy "plans_patient_create" on public.refill_plans for insert
  with check (auth.uid() = patient_id);

drop policy if exists "plans_patient_update" on public.refill_plans;
create policy "plans_patient_update" on public.refill_plans for update
  using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

create trigger refill_plans_set_updated_at before update on public.refill_plans
  for each row execute function public.set_updated_at();

-- 7. Refill plan drafts (saved before payment; pay-before-activation) --------

create table if not exists public.refill_plan_drafts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id),
  instructions text,
  frequency_days integer not null check (frequency_days > 0),
  next_refill_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.refill_plan_drafts enable row level security;

drop policy if exists "plan_drafts_patient_read" on public.refill_plan_drafts;
create policy "plan_drafts_patient_read" on public.refill_plan_drafts for select using (auth.uid() = patient_id);

drop policy if exists "plan_drafts_patient_create" on public.refill_plan_drafts;
create policy "plan_drafts_patient_create" on public.refill_plan_drafts for insert with check (auth.uid() = patient_id);

drop policy if exists "plan_drafts_patient_update" on public.refill_plan_drafts;
create policy "plan_drafts_patient_update" on public.refill_plan_drafts for update
  using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

drop policy if exists "plan_drafts_patient_delete" on public.refill_plan_drafts;
create policy "plan_drafts_patient_delete" on public.refill_plan_drafts for delete using (auth.uid() = patient_id);

create trigger refill_plan_drafts_set_updated_at before update on public.refill_plan_drafts
  for each row execute function public.set_updated_at();

create unique index if not exists "refill_plans_draft_id_unique"
  on public.refill_plans (draft_id) where draft_id is not null;

-- 8. Refill orders -----------------------------------------------------------

create table if not exists public.refill_orders (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.refill_plans(id) on delete restrict,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  medicine_id uuid references public.medicines(id) on delete restrict,
  status public.order_status not null default 'requested',
  patient_note text,
  pharmacist_note text,
  availability_confirmed boolean not null default false,
  private_price_amount numeric,
  private_price_currency text not null default 'USD',
  requested_for date not null default current_date,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.refill_orders enable row level security;

drop policy if exists "orders_patient_read" on public.refill_orders;
create policy "orders_patient_read" on public.refill_orders for select
  using (auth.uid() = patient_id or is_pharmacist());

-- Patients create refill requests pointing at their own plan.
drop policy if exists "orders_patient_create" on public.refill_orders;
create policy "orders_patient_create" on public.refill_orders for insert
  with check (
    auth.uid() = patient_id
    and exists (
      select 1 from public.refill_plans p
      where p.id = refill_orders.plan_id and p.patient_id = auth.uid()
    )
  );

-- Only pharmacists change order state. Patients must never update an order.
drop policy if exists "orders_pharmacist_update" on public.refill_orders;
create policy "orders_pharmacist_update" on public.refill_orders for update
  using (is_pharmacist()) with check (is_pharmacist());

create index if not exists refill_orders_queue_idx
  on public.refill_orders (status, requested_for, requested_at);
create index if not exists refill_orders_patient_idx
  on public.refill_orders (patient_id, requested_at desc);

-- At most one open refill order per plan; blocks double-submit races.
create unique index if not exists refill_orders_open_per_plan_unique
  on public.refill_orders (plan_id)
  where status in ('requested', 'reviewing', 'ready');

create trigger refill_orders_set_updated_at before update on public.refill_orders
  for each row execute function public.set_updated_at();

-- 9. Order conversation messages ---------------------------------------------

create table if not exists public.refill_order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.refill_orders(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists refill_order_messages_order_idx
  on public.refill_order_messages (order_id, created_at);
create index if not exists refill_order_messages_unread_idx
  on public.refill_order_messages (order_id, created_at)
  where read_at is null;

alter table public.refill_order_messages enable row level security;

drop policy if exists "Order participants can read messages" on public.refill_order_messages;
create policy "Order participants can read messages"
  on public.refill_order_messages for select
  using (
    sender_id = auth.uid()
    or exists (select 1 from public.refill_orders where refill_orders.id = refill_order_messages.order_id and refill_orders.patient_id = auth.uid())
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'pharmacist')
  );

drop policy if exists "Order participants can send messages" on public.refill_order_messages;
create policy "Order participants can send messages"
  on public.refill_order_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      exists (select 1 from public.refill_orders where refill_orders.id = refill_order_messages.order_id and refill_orders.patient_id = auth.uid())
      or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'pharmacist')
    )
  );

drop policy if exists "Order participants can mark messages read" on public.refill_order_messages;
create policy "Order participants can mark messages read"
  on public.refill_order_messages for update
  using (
    sender_id <> auth.uid()
    and (
      exists (select 1 from public.refill_orders where refill_orders.id = refill_order_messages.order_id and refill_orders.patient_id = auth.uid())
      or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'pharmacist')
    )
  )
  with check (
    sender_id <> auth.uid()
    and (
      exists (select 1 from public.refill_orders where refill_orders.id = refill_order_messages.order_id and refill_orders.patient_id = auth.uid())
      or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'pharmacist')
    )
  );

-- 10. Payments ----------------------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.refill_plans(id) on delete set null,
  order_id uuid references public.refill_orders(id) on delete set null,
  kind public.payment_kind not null,
  provider text not null default 'paystack',
  provider_reference text,
  amount numeric not null,
  currency text not null default 'USD',
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payments_provider_reference_key
  on public.payments (provider_reference);

alter table public.payments enable row level security;

drop policy if exists "payments_patient_read" on public.payments;
create policy "payments_patient_read" on public.payments for select
  using (auth.uid() = patient_id or is_pharmacist());

create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- 11. Notifications ------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  refill_plan_id uuid references public.refill_plans(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz default timezone('utc', now()),
  sent_at timestamptz,
  read_at timestamptz,
  status text default 'scheduled',
  created_at timestamptz not null default now()
);

create unique index if not exists notifications_refill_reminder_unique
  on public.notifications (refill_plan_id, type) where type = 'refill_reminder';

create index if not exists notifications_patient_idx on public.notifications (patient_id, scheduled_for);

alter table public.notifications enable row level security;

drop policy if exists "notifications_patient_read" on public.notifications;
create policy "notifications_patient_read" on public.notifications for select using (auth.uid() = patient_id);

drop policy if exists "notifications_patient_mark_read" on public.notifications;
create policy "notifications_patient_mark_read" on public.notifications for update
  using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

-- 12. Push subscriptions --------------------------------------------------------

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists push_subscriptions_patient_id_endpoint_key
  on public.push_subscriptions (patient_id, endpoint);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Patients can manage their push subscriptions" on public.push_subscriptions;
create policy "Patients can manage their push subscriptions"
  on public.push_subscriptions for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

-- 13. Legacy conversation tables (superseded by refill_order_messages; kept
-- because the live tables exist and carry no data) --------------------------------

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.refill_orders(id) on delete cascade,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  pharmacist_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists conversations_order_id_key on public.conversations (order_id);

alter table public.conversations enable row level security;

drop policy if exists "conversations_participant_read" on public.conversations;
create policy "conversations_participant_read" on public.conversations for select
  using (auth.uid() = patient_id or auth.uid() = pharmacist_id or is_pharmacist());

drop policy if exists "conversations_patient_create" on public.conversations;
create policy "conversations_patient_create" on public.conversations for insert
  with check (
    auth.uid() = patient_id
    and exists (select 1 from public.refill_orders o where o.id = conversations.order_id and o.patient_id = auth.uid())
  );

create trigger conversations_set_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

drop policy if exists "messages_participant_read" on public.messages;
create policy "messages_participant_read" on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.patient_id = auth.uid() or c.pharmacist_id = auth.uid() or is_pharmacist())
    )
  );

drop policy if exists "messages_participant_send" on public.messages;
create policy "messages_participant_send" on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.patient_id = auth.uid() or c.pharmacist_id = auth.uid() or is_pharmacist())
    )
  );
