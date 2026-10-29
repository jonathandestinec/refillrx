# RefillRx Sitemap

Pharmacy: **Mani, Benin City**

## Current MVP route mapping

The implemented MVP uses `/dashboard` for the patient workspace and `/pharmacy` for the pharmacist workspace. Conversations have dedicated tabs at `/dashboard/messages` and `/pharmacy/messages`; they are not embedded in the overview or queue cards.

## Route tree

```text
/
├── /about
├── /pricing
├── /login
├── /register
├── /forgot-password
├── /offline
│
├── /patient
│   ├── /dashboard
│   ├── /plans
│   │   ├── /new
│   │   └── /[planId]
│   ├── /orders
│   │   └── /[orderId]
│   ├── /messages
│   │   └── /[conversationId]
│   ├── /history
│   └── /settings
│
└── /pharmacist
    ├── /queue
    ├── /orders
    │   └── /[orderId]
    ├── /messages
    │   └── /[conversationId]
    ├── /patients
    │   └── /[patientId]
    └── /settings
```

## Public routes

### `/`

**Purpose:** Explain RefillRx and introduce Mani, Benin City through an editorial, illustration-led landing page.

**Landing page sections:**

1. Black split hero with the main promise, primary CTA, and a large supplied doodle.
2. Interactive card-deck use-case section using the five supplied doodles.
3. Patient dashboard preview with next refill, reminder, status, and chat.
4. Mani, Benin City trust and pharmacist workflow information.
5. Service fee explanation and testable signup CTA.
6. FAQ and final signup CTA.

**Primary actions:**

- Create an account
- Sign in
- Explore patient and pharmacist use cases

**Content:**

- Refill reminder value proposition
- Three-step explanation: plan, reminder, pickup
- Mani pharmacy location and service information
- Monthly service fee explanation
- Privacy note: medication prices are confirmed privately by the pharmacist

**Interaction:**

- Hero CTA moves visitors to registration.
- Scroll cue moves visitors to the interactive use cases.
- The use-case cards flip on click or keyboard activation.
- The selected card becomes the visual focus while sibling cards tilt/spread slightly.
- The patient preview demonstrates the dashboard and pharmacist chat experience.

### `/about`

**Purpose:** Provide real pharmacy information.

**Content:**

- Mani, Benin City
- Pharmacy service description
- Opening hours placeholder to be confirmed
- Contact information placeholder to be confirmed
- Pickup instructions

### `/pricing`

**Purpose:** Explain the monthly RefillRx service fee.

**Rules:**

- Show the subscription/service fee only.
- Do not show public medicine prices.
- Explain that medicine prices are confirmed by the pharmacist.

## Authentication routes

### `/login`

Supports both patient and pharmacist accounts. After login, redirect based on role:

- Patient → `/patient/dashboard`
- Pharmacist → `/pharmacist/queue`

### `/register`

Creates a patient account. Pharmacist accounts are seeded or created through a controlled setup flow.

### `/forgot-password`

Provides password recovery or a demo-safe placeholder until email delivery is connected.

## Patient routes

All patient routes require an authenticated user with the `patient` role.

### `/patient/dashboard`

The patient’s home screen.

**Shows:**

- Greeting and pharmacy name
- Active refill plans
- Next refill date
- Reminder date
- Current order status
- Recent refill history

**Primary action:** Register a refill plan or request a due refill.

### `/patient/plans/new`

Form for registering a recurring medication plan.

**Fields:**

- Medicine
- Dosage instructions
- Refill frequency
- Next refill date
- Optional notes for the pharmacist

**Behavior:**

- Prescription-required medicines show a pharmacist review notice.
- The app calculates the reminder date as three days before the next refill date.
- The app does not expose medication prices on this screen.

### `/patient/plans/[planId]`

Details for one active refill plan.

**Actions:**

- Request the next refill
- Pause the plan
- Cancel the plan
- Edit plan details

### `/patient/orders/[orderId]`

Tracks one refill order.

**Status progression:**

```text
Requested
  → Under pharmacist review
  → Confirmed
  → Ready for pickup
  → Collected
```

The patient sees the confirmed medicine amount only after the pharmacist confirms the order. Before that, the interface shows that pricing is pending pharmacist confirmation.

### `/patient/messages`

Lists the patient’s conversations, grouped by refill order.

**Shows:**

- Pharmacy name: Mani, Benin City
- Last message preview
- Unread count
- Order status shortcut

### `/patient/messages/[conversationId]`

One-to-one chat between the patient and the pharmacist assigned to the order.

**Rules:**

- The conversation is attached to an order.
- Patients can ask about availability, pickup, or clarification.
- The chat is not a general medical advice channel.
- The patient can see the pharmacist’s name and role.

### `/patient/history`

Lists previous refill orders with:

- Medicine name and brand
- Request date
- Pickup date
- Final status
- Order details link

### `/patient/settings`

Manages:

- Name and contact details
- Notification preference
- Password
- Service subscription/payment status

## Pharmacist routes

All pharmacist routes require an authenticated user with the `pharmacist` role.

### `/pharmacist/queue`

The pharmacist’s work queue.

**Queue sections:**

- New requests
- Under review
- Ready for pickup
- Recently collected

**Each queue item shows:**

- Patient name
- Medicine and strength
- Request date
- Prescription review flag
- Current status

### `/pharmacist/orders/[orderId]`

Review and update one refill order.

**Actions:**

- Confirm availability
- Enter the privately confirmed medicine price
- Add a pharmacist note
- Mark ready for pickup
- Mark collected
- Cancel or request clarification

### `/pharmacist/messages`

Lists patient conversations attached to active refill orders, with unread messages and queue status.

### `/pharmacist/messages/[conversationId]`

Allows the assigned pharmacist to reply to the patient, provide pickup clarification, and update the order when appropriate.

### `/pharmacist/patients/[patientId]`

Shows a patient’s refill history and active plans. This is restricted to the pharmacist role.

### `/pharmacist/settings`

Manages:

- Pharmacy profile
- Pickup instructions
- Opening hours
- Pharmacist account details

## PWA and offline behavior

The PWA is a product capability rather than a standalone user-facing section.

- `/manifest.webmanifest` — App name, Mani/ReFillRx branding, icons, colors, and install metadata.
- `/offline` — Friendly fallback shown when a requested page is unavailable offline.
- Service worker — Caches the public shell and safe read-only UI assets.
- Push notifications — Used for refill reminders, order status changes, and new chat messages after permission is granted.
- Sensitive order, payment, and chat data must not be treated as permanently available offline.

## Shared navigation

### Public navigation

- RefillRx logo
- Use cases
- Patient view
- For Mani
- About Mani
- Service fee
- FAQ
- Sign in
- Create account

### Patient navigation

- Dashboard
- My refill plans
- Orders
- Messages
- History
- Settings
- Sign out

### Pharmacist navigation

- Queue
- Orders
- Messages
- Patients
- Settings
- Sign out

## Route protection

| Route group | Access | Redirect when unauthorised |
| --- | --- | --- |
| Public routes | Anyone | Not applicable |
| `/patient/*` | Authenticated patients | `/login` or the correct dashboard |
| `/pharmacist/*` | Authenticated pharmacists | `/login` or `/patient/dashboard` |
| Private order data | Owner patient or pharmacist | `/login` or `403` response |

## Primary navigation flows

### New patient flow

```text
Landing page
  → Register
  → Patient dashboard
  → Register refill plan
  → Plan details
```

### Refill request flow

```text
Patient dashboard
  → Plan details
  → Request refill
  → Order details
  → Pharmacist queue
  → Pharmacist order details
  → Ready for pickup
```

### Returning patient flow

```text
Login
  → Patient dashboard
  → Upcoming refill
  → Request refill
  → Track order status
```

### Pharmacist flow

```text
Login
  → Pharmacist queue
  → Open refill order
  → Confirm availability and private price
  → Mark ready for pickup
  → Mark collected
```

### Chat flow

```text
Patient order details
  → Message pharmacist
  → Conversation
  → New message notification
  → Pharmacist conversation
  → Reply or update order
```

## First implementation slice

The first screens to build are:

1. `/` — Public landing page with hero, doodles, and interactive card deck
2. `/login` — Shared login screen
3. `/patient/dashboard` — Patient dashboard shell
4. `/patient/plans/new` — Refill plan form
5. `/pharmacist/queue` — Pharmacist queue shell
6. `/patient/messages/[conversationId]` — Order-linked chat shell

These screens establish the primary product story before we connect the database, payments, authentication, PWA notifications, and reminder automation.
