export const MONTHLY_PLAN_PAYMENT = {
  amount: 6735,
  amountMinor: 673500,
  currency: "NGN",
  kind: "monthly_plan",
} as const;

export const MONTHLY_PLAN_PAYMENT_LABEL = "₦6,735/month";

export function createPaymentReference() {
  return `refillrx-${crypto.randomUUID()}`;
}
