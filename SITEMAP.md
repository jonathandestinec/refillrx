# RefillRx Sitemap

Pharmacy: **Mani, Benin City**

## Route tree

```text
/
├── /about
├── /pricing
├── /login
├── /register
├── /forgot-password
│
├── /patient
│   ├── /dashboard
│   ├── /plans
│   │   ├── /new
│   │   └── /[planId]
│   ├── /orders
│   │   └── /[orderId]
│   ├── /history
│   └── /settings
│
└── /pharmacist
    ├── /queue
    ├── /orders
    │   └── /[orderId]
    ├── /patients
    │   └── /[patientId]
    └── /settings
```

## Public routes

### `/`

**Purpose:** Explain RefillRx and introduce Mani, Benin City.

**Primary actions:**

- Create an account
- Sign in
- Learn how the refill service works

**Content:**

- Refill reminder value proposition
- Three-step explanation: plan, reminder, pickup
- Mani pharmacy location and service information
- Monthly service fee explanation
- Privacy note: medication prices are confirmed privately by the pharmacist

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

### `/pharmacist/patients/[patientId]`

Shows a patient’s refill history and active plans. This is restricted to the pharmacist role.

### `/pharmacist/settings`

Manages:

- Pharmacy profile
- Pickup instructions
- Opening hours
- Pharmacist account details

## Shared navigation

### Public navigation

- RefillRx logo
- How it works
- About Mani
- Service fee
- Sign in
- Create account

### Patient navigation

- Dashboard
- My refill plans
- Orders
- History
- Settings
- Sign out

### Pharmacist navigation

- Queue
- Orders
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

## First implementation slice

The first screens to build are:

1. `/` — Public landing page
2. `/login` — Shared login screen
3. `/patient/dashboard` — Patient dashboard shell
4. `/patient/plans/new` — Refill plan form
5. `/pharmacist/queue` — Pharmacist queue shell

These five screens establish the primary product story before we connect the database, payments, authentication, and reminder automation.
