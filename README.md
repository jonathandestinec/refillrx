# RefillRx

A community pharmacy refill service for **Mani, Benin City**. Patients keep a
recurring medicine plan, are reminded three days before their next refill, chat
with the pharmacist about an active order, and know when it is ready for pickup.
Medicine prices are never public: the pharmacist confirms them privately per
order.

## Stack

- Next.js (App Router) + React · deployed on Vercel
- Supabase (Postgres, Auth, Realtime, RLS) · migrations in `supabase/migrations`
- Paystack **test mode** for the monthly service fee
- Web Push (VAPID) + Resend email for reminders, delivered by a Vercel cron

## Setup

1. Install dependencies: `npm install`
2. Apply the schema to a Supabase project: paste `supabase/migrations/*.sql`
   (in filename order) and `supabase/seed.sql` into the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and fill in every variable. Notes:
   - `NEXT_PUBLIC_SITE_URL` must match the public origin (localhost for dev,
     the Vercel URL in production); Paystack callback URLs derive from it.
   - Generate the VAPID pair with `npx web-push generate-vapid-keys`.
   - Set `CRON_SECRET` to a long random string; Vercel cron sends it as the
     bearer token to `/api/notifications/process`.
   - `RESEND_FROM` must use a sender identity verified in Resend.
4. `npm run dev`

## Demo accounts

- **Patient:** register through `/sign-up` (e.g. Amina + Amlodipine plan).
- **Pharmacist:** create an account, then set
  `profiles.role = 'pharmacist'` and `auth.users.raw_app_meta_data.role =
  'pharmacist'` for that user, then sign out and sign back in once so the JWT
  carries the role claim. See `supabase/seed.sql` §3.

## Payment model

Payment happens before plan activation: the patient saves a plan draft, pays
the monthly fee in Paystack test mode, and the plan activates once the server
verifies the transaction (amount + currency checked) — via browser callback,
the verify endpoint, or the Paystack webhook
(`/api/payments/paystack/webhook`, register the deployed URL in the Paystack
dashboard with the secret key). No live keys, no real cards.

## Order lifecycle

`requested → reviewing → ready → completed` (or `cancelled`). Keepups:

- Only pharmacists move an order; transitions are whitelisted server-side.
- `ready`/`completed` require availability plus a privately confirmed price.
- Chat messages are per-order; both parties get push notifications, and unread
  state is tracked per message.
- Completing an order advances the plan's next refill date and re-arms the
  3-day reminder.

## Reminders

A Vercel cron runs `/api/notifications/process` daily (07:00 WAT). Each due
`notifications` row (the 3-day reminder) is delivered by web push and, when the
patient has no push subscription or push fails, by Resend email to the account
email. Failed deliveries retry on later runs up to 3 attempts, and dead push
subscriptions are cleaned up automatically.
