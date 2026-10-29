import Image from "next/image";
import Link from "next/link";

import { MONTHLY_PLAN_PAYMENT_LABEL } from "@/lib/payments";

import BrandMark, { MedicineMark } from "./components/brand-mark";
import UseCaseDeck from "./components/use-case-deck";

export default function Home() {
  return (
    <main className="site-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <section className="hero-section" id="top">
        <nav className="site-nav" aria-label="Primary navigation">
          <BrandMark href="#top" />

          <div className="desktop-nav-links">
            <Link href="#use-cases">How it works</Link>
            <Link href="#patient-view">For patients</Link>
            <Link href="#for-mani">For Mani</Link>
            <Link href="/login">Sign in</Link>
          </div>

          <Link className="nav-cta" href="/sign-up">
            Start a refill plan <span aria-hidden="true">↗</span>
          </Link>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow eyebrow--light">
              <span className="eyebrow-dot" aria-hidden="true" />
              Community pharmacy · Benin City
            </p>
            <h1>Stay ready for your next <em>refill.</em></h1>
            <p className="hero-description">
              RefillRx helps patients keep recurring medicines on schedule,
              request a refill, and hear from Mani when it is ready.
            </p>
            <div className="hero-actions">
              <Link className="button button--lime" href="/sign-up">
                Start a refill plan <span aria-hidden="true">↗</span>
              </Link>
              <Link className="text-link text-link--light" href="#use-cases">
                See how a refill moves <span aria-hidden="true">↓</span>
              </Link>
            </div>
            <div className="hero-note">
              <span className="hero-note__avatar" aria-hidden="true">M</span>
              <span>
                <strong>Mani, Benin City</strong>
                <small>Open daily, 7am–6pm · Pickup at the pharmacy</small>
              </span>
            </div>
          </div>

          <div className="hero-art" role="img" aria-label="Refill plan illustration">
            <div className="hero-art__topline">
              <span>Refill plan</span>
              <span className="hero-art__status">Scheduled</span>
            </div>
            <div className="hero-art__image-wrap">
              <Image
                src="/doodles/01-refill-plan.svg"
                alt=""
                fill
                sizes="(max-width: 900px) 88vw, 48vw"
                className="hero-art__image"
                priority
              />
            </div>
            <div className="hero-art__caption">
              <span>
                <small>Next step</small>
                <strong>Request your refill</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="hero-bottomline">
          <span>Recurring medicine, on schedule.</span>
          <span className="scroll-cue" aria-hidden="true">↓</span>
          <span>See how a refill moves</span>
        </div>
      </section>

      <div id="main-content">
        <section className="deck-section section-pad" id="use-cases">
          <div className="deck-heading">
            <div>
              <div className="section-kicker section-kicker--dark">
                <span className="section-number">01</span>
                <span>How a refill moves</span>
              </div>
              <h2>One routine. Five useful <span>moments.</span></h2>
            </div>
            <p>
              Tap once to bring a moment forward. Tap again to see what RefillRx
              does for the patient or the pharmacist.
            </p>
          </div>
          <UseCaseDeck />
        </section>

        <section className="patient-section section-pad" id="patient-view">
          <div className="patient-section__copy">
            <div className="section-kicker">
              <span className="section-number">02</span>
              <span>For patients</span>
            </div>
            <h2>See the next step before it becomes <span>urgent.</span></h2>
            <p className="section-lede">
              One focused view for the next refill, the reminder, the pickup
              status, and the conversation with Mani.
            </p>
            <div className="patient-feature-list">
              <div className="patient-feature">
                <span className="patient-feature__icon">01</span>
                <span><strong>Next refill</strong><small>Know which routine needs attention.</small></span>
              </div>
              <div className="patient-feature">
                <span className="patient-feature__icon">02</span>
                <span><strong>Three-day reminder</strong><small>Get time to act before you run out.</small></span>
              </div>
              <div className="patient-feature">
                <span className="patient-feature__icon">03</span>
                <span><strong>Pharmacist chat</strong><small>Ask about the active refill order.</small></span>
              </div>
            </div>
          </div>

          <div className="patient-preview" aria-label="Example RefillRx patient dashboard">
            <div className="patient-preview__topbar">
              <span className="patient-preview__mini-brand"><MedicineMark /> refill<span>rx</span></span>
              <span className="patient-preview__notification">2</span>
            </div>
            <div className="patient-preview__greeting">
              <small>Patient dashboard</small>
              <h3>Your next refill.</h3>
            </div>
            <div className="patient-preview__next">
              <div>
                <small>Recurring medicine</small>
                <strong>Refill plan</strong>
                <span>Next cycle · Mani, Benin City</span>
              </div>
              <span className="status-pill status-pill--lime">Planned</span>
            </div>
            <div className="patient-preview__status">
              <div><span className="status-dot" />Reminder scheduled</div>
              <span>3 days early</span>
            </div>
            <div className="chat-preview">
              <span className="chat-preview__avatar">M</span>
              <span><small>Message from Mani</small><strong>Your refill is ready for pickup.</strong></span>
              <span className="chat-preview__arrow" aria-hidden="true">↗</span>
            </div>
          </div>
        </section>

        <section className="outcome-section outcome-section--reverse section-pad" id="reminder">
          <div className="outcome-copy">
            <div className="section-kicker">
              <span className="section-number">03</span>
              <span>Three-day reminder</span>
            </div>
            <h2>Get time to act before you <span>run out.</span></h2>
            <p className="section-lede">
              RefillRx reminds the patient three days before the planned refill,
              so there is time to request it and time for Mani to review it.
            </p>
            <p className="outcome-note">Reminder window · 3 days before refill</p>
          </div>
          <div className="outcome-art">
            <Image src="/doodles/02-three-day-reminder.svg" alt="Illustration of a three-day refill reminder" width={600} height={600} />
          </div>
        </section>

        <section className="outcome-section section-pad" id="pickup">
          <div className="outcome-art">
            <Image src="/doodles/04-ready-for-pickup.svg" alt="Illustration of a refill ready for pickup" width={600} height={600} />
          </div>
          <div className="outcome-copy">
            <div className="section-kicker">
              <span className="section-number">04</span>
              <span>Pickup status</span>
            </div>
            <h2>Make one useful trip to the <span>counter.</span></h2>
            <p className="section-lede">
              Mani marks the order ready after review. RefillRx shows that status
              clearly, so patients do not have to guess whether their medicine has arrived.
            </p>
            <p className="outcome-note">Ready for pickup · Mani, Benin City</p>
            <div className="patient-feature-list">
              <div className="patient-feature">
                <span className="patient-feature__icon">01</span>
                <span><strong>Collect at the counter</strong><small>Mani hands over the order in person, open daily 7am–6pm.</small></span>
              </div>
              <div className="patient-feature">
                <span className="patient-feature__icon">02</span>
                <span><strong>No delivery, on purpose</strong><small>Medicines are never mailed out, so the pharmacist can check each handover for safety.</small></span>
              </div>
            </div>
          </div>
        </section>

        <section className="outcome-section outcome-section--reverse section-pad" id="history">
          <div className="outcome-copy">
            <div className="section-kicker">
              <span className="section-number">05</span>
              <span>Refill history</span>
            </div>
            <h2>Keep the context for the <span>next cycle.</span></h2>
            <p className="section-lede">
              Completed orders keep the medicine routine, date, and outcome in
              one place, so the next refill starts with less guesswork.
            </p>
          </div>
          <div className="outcome-art">
            <Image src="/doodles/05-refill-history.svg" alt="Illustration of a refill history record" width={600} height={600} />
          </div>
        </section>

        <section className="trust-section section-pad" id="for-mani">
          <div className="trust-art">
            <Image src="/doodles/03-pharmacist-queue.svg" alt="Illustration of a pharmacist reviewing refill requests" width={600} height={600} />
            <span className="trust-art__label">Pharmacist queue</span>
          </div>
          <div className="trust-copy">
            <div className="section-kicker">
              <span className="section-number">06</span>
              <span>For Mani</span>
            </div>
            <h2>Review the right requests with the right <span>context.</span></h2>
            <p className="section-lede">
              Mani gets one queue for refill requests, private price confirmation,
              and the patient conversation attached to the order.
            </p>
            <div className="trust-capabilities">
              <div><strong>Due requests first</strong><span>See which refill plans need review.</span></div>
              <div><strong>Private confirmation</strong><span>Keep availability and pricing out of public view.</span></div>
              <div><strong>Conversation in context</strong><span>Answer the patient beside the active order.</span></div>
            </div>
            <p className="trust-contact">
              Questions about a refill? Call or WhatsApp Mani on{" "}
              <a href="tel:+2349061426386">+234 906 142 6386</a>, or visit the counter — open daily, 7am–6pm.
            </p>
            <p className="outcome-note">Mani, Benin City · +234 906 142 6386 · 7am–6pm daily</p>
          </div>
        </section>

        <section className="faq-section section-pad" id="faq">
          <div>
            <div className="section-kicker">
              <span className="section-number">07</span>
              <span>Good to know</span>
            </div>
            <h2>Clear answers before you <span>start.</span></h2>
          </div>
          <div className="faq-list">
            <details open>
              <summary>Are medicine prices shown publicly?</summary>
              <p>No. Mani confirms availability and pricing privately when a refill order is reviewed.</p>
            </details>
            <details>
              <summary>What does the service include?</summary>
              <p>Refill planning, a reminder three days early, order status updates, and chat with Mani about an active refill.</p>
            </details>
            <details>
              <summary>Can prescription medicines be reviewed?</summary>
              <p>Yes. Prescription-required medicines are flagged for pharmacist review before an order is confirmed.</p>
            </details>
            <details>
              <summary>Do refills get delivered?</summary>
              <p>No. Every refill is collected in person at Mani's counter in Benin City. Handing over medicines in person lets the pharmacist answer questions and confirm the right medicine goes to the right patient.</p>
            </details>
            <details>
              <summary>When is the pharmacy open?</summary>
              <p>Mani opens every day from 7am to 6pm. Call or WhatsApp the counter on +234 906 142 6386 if you are running late for a pickup.</p>
            </details>
          </div>
        </section>

        <section className="service-section section-pad" id="service">
          <div className="service-card">
            <div>
              <p className="eyebrow">A clear monthly plan</p>
              <h2>Keep the next refill <em>within reach.</em></h2>
            </div>
            <div className="service-card__right">
              <p><strong>{MONTHLY_PLAN_PAYMENT_LABEL}.</strong> One payment covers one month of refill planning and status updates. Payment happens before registering a plan.</p>
              <Link className="button button--dark" href="/sign-up">Start a refill plan <span aria-hidden="true">↗</span></Link>
              <small>One-time or in-person payment remains available for a refill request.</small>
            </div>
          </div>
        </section>

        <footer className="site-footer">
          <div className="footer-brand">
            <BrandMark href="#top" className="brand-mark--dark" />
            <p>Refill care, kept close.</p>
          </div>
          <div className="footer-location">
            <span>Community pharmacy</span>
            <strong>Mani, Benin City</strong>
          </div>
          <div className="footer-links">
            <Link href="#use-cases">How it works</Link>
            <Link href="#faq">Questions</Link>
            <Link href="#service">Service</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
