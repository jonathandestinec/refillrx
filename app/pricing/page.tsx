import Link from "next/link";

import { MONTHLY_PLAN_PAYMENT_LABEL } from "@/lib/payments";
import BrandMark from "@/app/components/brand-mark";

export default function PricingPage() {
  return (
    <main className="simple-page">
      <header className="simple-page__nav"><BrandMark href="/" /><Link className="text-link" href="/">Back to RefillRx <span aria-hidden="true">↗</span></Link></header>
      <section className="simple-page__hero">
        <p className="eyebrow">Service fee · Mani, Benin City</p>
        <h1>One clear fee for a steadier refill routine.</h1>
        <p>RefillRx covers refill planning, the three-day reminder, status updates, and a secure conversation with Mani about an active order.</p>
        <div className="simple-page__card"><span>Monthly refill service</span><strong>{MONTHLY_PLAN_PAYMENT_LABEL}</strong><small>Medicine prices are confirmed privately by the pharmacist and are not included in this fee.</small></div>
        <Link className="button button--dark" href="/sign-up">Start a refill plan <span aria-hidden="true">↗</span></Link>
      </section>
    </main>
  );
}
