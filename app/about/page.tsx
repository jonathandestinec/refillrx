import Link from "next/link";

import BrandMark from "@/app/components/brand-mark";

export default function AboutPage() {
  return (
    <main className="simple-page">
      <header className="simple-page__nav"><BrandMark href="/" /><Link className="text-link" href="/">Back to RefillRx <span aria-hidden="true">↗</span></Link></header>
      <section className="simple-page__hero">
        <p className="eyebrow">Community pharmacy · Benin City</p>
        <h1>Refill care, kept close.</h1>
        <p>RefillRx is a simple service from Mani for patients taking recurring medicines. It keeps the next refill visible, gives the pharmacy time to review it, and keeps pickup in person.</p>
        <div className="simple-page__facts"><div><strong>Where</strong><span>Mani, Benin City</span></div><div><strong>Hours</strong><span>Daily · 7am–6pm</span></div><div><strong>Pickup</strong><span>At the pharmacy counter</span></div></div>
        <Link className="button button--dark" href="/sign-up">Create your refill plan <span aria-hidden="true">↗</span></Link>
      </section>
    </main>
  );
}
