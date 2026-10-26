# RefillRx Project Plan

## 1. Product overview

**Product:** RefillRx

**Pharmacy:** Mani, Benin City

**Category:** Community pharmacy refill service

**Primary problem:** Patients taking recurring medication forget to request their next refill.

**Product promise:** RefillRx helps patients keep a simple refill plan, receive a reminder three days before the due date, and know when their order is ready for pickup at Mani.

## 2. Users and roles

### Patient

- Creates an account and signs in.
- Registers a recurring medication refill plan.
- Sees the next refill date and current plan status.
- Requests the next refill.
- Tracks pharmacist confirmation and pickup readiness.
- Reviews previous refill orders.

### Pharmacist

- Signs in to a protected pharmacist area.
- Reviews the refill queue.
- Confirms medication availability and the patient’s order price privately.
- Marks an order as ready for pickup.
- Marks an order as collected.
- Reviews patient and order history.

## 3. Product rules

- Mani, Benin City is the only pharmacy location in the MVP.
- The monthly service fee is separate from medication prices.
- Medication prices are stored for pharmacist confirmation but are not displayed publicly.
- Prescription-required medicines must be flagged for pharmacist review.
- The first payment integration will use test mode only.
- Demo records will be seeded and clearly treated as sample data; no real patient health data will be used.

## 4. MVP scope

### In scope

- Public pharmacy landing page.
- Patient registration and login.
- Pharmacist registration/login or seeded pharmacist access.
- Patient dashboard.
- Refill plan registration.
- Refill request creation.
- Pharmacist refill queue.
- Order status updates.
- Patient refill history.
- Monthly service fee in Paystack or Flutterwave test mode.
- Automated reminder three days before the next refill date.
- Responsive mobile-first interface.
- Deployment to Vercel.

### Out of scope for the first version

- Delivery logistics.
- Multiple pharmacy branches.
- Insurance claims.
- Doctor or hospital integrations.
- Public medicine marketplace or public price comparison.
- Real patient medical records.
- Production payment collection.

## 5. Main user flow

1. A patient visits the RefillRx landing page.
2. The patient creates an account or signs in.
3. The patient registers a medication, dosage, refill frequency, and next refill date.
4. RefillRx saves the plan and calculates the reminder date.
5. The patient pays the monthly service fee through a test payment flow.
6. Three days before the due date, the reminder automation sends a notification.
7. The patient requests the refill.
8. The pharmacist sees the request in the queue.
9. The pharmacist confirms availability and privately confirms the price.
10. The pharmacist marks the order as ready for pickup.
11. The patient sees the ready-for-pickup status.
12. The pharmacist marks the order as collected, and the order appears in history.

## 6. Sitemap

### Public pages

- `/` — RefillRx landing page
- `/login` — Sign in
- `/register` — Create account
- `/pricing` — Monthly service fee and service explanation
- `/about` — Mani pharmacy information

### Patient pages

- `/patient/dashboard` — Active plans, upcoming refill, recent status
- `/patient/plans/new` — Register a refill plan
- `/patient/plans/[id]` — Plan details and request refill
- `/patient/orders/[id]` — Order status and pickup information
- `/patient/history` — Previous orders
- `/patient/settings` — Profile and notification preferences

### Pharmacist pages

- `/pharmacist/queue` — Pending and active refill requests
- `/pharmacist/orders/[id]` — Review and update an order
- `/pharmacist/patients/[id]` — Patient refill history
- `/pharmacist/settings` — Pharmacy and account settings

## 7. Initial data model

### `users`

- `id`
- `name`
- `email`
- `phone`
- `role` — `patient` or `pharmacist`
- `created_at`

### `medicines`

- `id`
- `name`
- `brand`
- `category`
- `dosage_form`
- `pack_size`
- `price_ngn` — private pharmacist-confirmed price
- `prescription_required`

### `refill_plans`

- `id`
- `patient_id`
- `medicine_id`
- `dosage_instructions`
- `frequency_days`
- `next_refill_date`
- `status` — `active`, `paused`, or `cancelled`
- `created_at`

### `orders`

- `id`
- `refill_plan_id`
- `patient_id`
- `medicine_id`
- `status` — `requested`, `under_review`, `confirmed`, `ready_for_pickup`, `collected`, or `cancelled`
- `requested_at`
- `confirmed_at`
- `ready_at`
- `collected_at`
- `pharmacist_note`

### `payments`

- `id`
- `patient_id`
- `provider`
- `reference`
- `amount_ngn`
- `status`
- `paid_at`

### `notifications`

- `id`
- `patient_id`
- `refill_plan_id`
- `type` — `refill_reminder` or `order_update`
- `scheduled_for`
- `sent_at`
- `status`

## 8. Seed medicines

The supplied medicine list will be used as local demo inventory. It includes medicines such as Paracetamol, Ibuprofen, Amoxicillin, Artemether/Lumefantrine, Amlodipine, Losartan, and other common products.

The supplied NGN prices will be treated as internal sample prices. They must not appear on public landing pages or unauthenticated medicine listings. Pharmacist confirmation is required before a patient sees a confirmed order amount.

## 9. Visual direction

- Trustworthy, calm healthcare interface.
- Mobile-first because many users will access the service from a phone.
- Warm off-white backgrounds with pharmacy green as the primary accent.
- Orange used sparingly for important actions and status highlights.
- Clear status badges and simple progress indicators.
- Plain language and locally relevant copy for Benin City.
- No fabricated reviews or testimonials.

## 10. Implementation phases

### Phase 1 — Foundation

- Replace the default Next.js starter screen.
- Establish the visual system and navigation.
- Build the public landing page and responsive shell.

### Phase 2 — Patient experience

- Add authentication screens.
- Build the patient dashboard.
- Add refill plan registration and seeded data.
- Add refill request and order tracking.

### Phase 3 — Pharmacist experience

- Add protected pharmacist routes.
- Build the queue and order detail views.
- Add status transitions and private price confirmation.

### Phase 4 — Data, payment, and automation

- Connect the database.
- Add test-mode monthly service payment.
- Add the three-day reminder workflow.
- Log notification activity.

### Phase 5 — Ship and verify

- Test unauthorized access to patient and pharmacist routes.
- Test the complete demo flow on mobile and desktop.
- Add real local pharmacy content.
- Deploy to Vercel.
- Prepare the five-minute presentation.

## 11. Demo script

The final demo should show one complete story:

1. Patient Amina signs in.
2. She registers a monthly refill plan for Amlodipine.
3. She completes the monthly service fee in test mode.
4. The app displays her next refill date and reminder date.
5. She requests the refill.
6. A pharmacist signs in and sees the request in the queue.
7. The pharmacist confirms the order and marks it ready for pickup.
8. Amina sees the updated status.
9. The pharmacist marks it collected.
10. The order appears in Amina’s history.

## 12. First build task

The first implementation task is to create the RefillRx visual foundation and public landing page for Mani, Benin City. Once that shell is approved, we will build the patient dashboard and refill flow as the first vertical slice.
