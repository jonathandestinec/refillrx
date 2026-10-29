create table if not exists public.refill_order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.refill_orders(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists refill_order_messages_order_idx
  on public.refill_order_messages (order_id, created_at);

alter table public.refill_order_messages enable row level security;

drop policy if exists "Order participants can read messages" on public.refill_order_messages;
create policy "Order participants can read messages"
  on public.refill_order_messages for select
  using (
    sender_id = auth.uid()
    or exists (
      select 1 from public.refill_orders
      where refill_orders.id = refill_order_messages.order_id
        and refill_orders.patient_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'pharmacist'
    )
  );

drop policy if exists "Order participants can send messages" on public.refill_order_messages;
create policy "Order participants can send messages"
  on public.refill_order_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      exists (
        select 1 from public.refill_orders
        where refill_orders.id = refill_order_messages.order_id
          and refill_orders.patient_id = auth.uid()
      )
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.role = 'pharmacist'
      )
    )
  );
