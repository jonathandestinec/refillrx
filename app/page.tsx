import Image from "next/image";
import Link from "next/link";

import UseCaseDeck from "./components/use-case-deck";

const stats = [
  ["3 days", "early reminder"],
  ["1 place", "for your refill history"],
  ["0 prices", "shown publicly"],
];

function MedicineMark() {
  return (
    <span className="medicine-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" role="presentation">
        <circle cx="16" cy="16" r="14" fill="#d8f16d" />
        <g transform="rotate(-45 16 16)">
          <rect x="8" y="11" width="16" height="10" rx="5" fill="#111111" />
          <path d="M16 11v10" stroke="#d8f16d" strokeWidth="1.5" />
        </g>
      </svg>
    </span>
  );
}

export default function Home() {
  return (
    <main className="site-shell">
      <section className="hero-section" id="top">
        <nav className="site-nav" aria-label="Primary navigation">
          <Link className="brand-mark" href="#top" aria-label="RefillRx home">
            <MedicineMark />
            refill<span>rx</span>
          </Link>

          <div className="desktop-nav-links">
            <Link href="#use-cases">Use cases</Link>
            <Link href="#patient-view">Patient view</Link>
            <Link href="#for-mani">For Mani</Link>
          </div>

          <Link className="nav-cta" href="/register">
            Get started <span aria-hidden="true">↗</span>
          </Link>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow eyebrow--light">
              <span className="eyebrow-dot" aria-hidden="true" />
              Community pharmacy · Benin City
            </p>
            <h1>
              Stay ready for your next <em>refill.</em>
            </h1>
            <p className="hero-description">
              RefillRx keeps your recurring medicines on track, connects you to
              Mani, and tells you when your order is ready for pickup.
            </p>
            <div className="hero-actions">
              <Link className="button button--lime" href="/register">
                Create your refill plan <span aria-hidden="true">↗</span>
              </Link>
              <Link className="text-link text-link--light" href="#use-cases">
                Explore use cases <span aria-hidden="true">↓</span>
              </Link>
            </div>
            <div className="hero-note">
              <span className="hero-note__avatar" aria-hidden="true">M</span>
              <span>
                <strong>Mani, Benin City</strong>
                <small>Pharmacist-confirmed pickup</small>
              </span>
            </div>
          </div>

          <div className="hero-art" aria-label="RefillRx refill plan preview">
            <div className="hero-art__topline">
              <span>your refill rhythm</span>
              <span className="hero-art__spark" aria-hidden="true">✳</span>
            </div>
            <div className="hero-art__image-wrap">
              <Image
                src="/doodles/01-refill-plan.svg"
                alt="Colorful illustration of a patient preparing a refill plan"
                fill
                sizes="(max-width: 900px) 88vw, 48vw"
                className="hero-art__image"
                priority
              />
            </div>
            <div className="hero-art__caption">
              <span>
                <small>Next refill</small>
                <strong>Thursday, 14 Nov</strong>
              </span>
              <span className="hero-art__arrow" aria-hidden="true">↗</span>
            </div>
          </div>
        </div>

        <div className="hero-bottomline">
          <span>Medication routine, made lighter.</span>
          <span className="scroll-cue" aria-hidden="true">↓</span>
          <span>Scroll to explore</span>
        </div>
      </section>

      <section className="deck-section section-pad" id="use-cases">
        <div className="deck-heading">
          <div>
            <div className="section-kicker section-kicker--dark">
              <span className="section-number">01</span>
              <span>Try the rhythm</span>
            </div>
            <h2>
              Tap a card. See how RefillRx <span>fits.</span>
            </h2>
          </div>
          <p>
            Each card opens a little product moment. Choose a use case to see
            what the patient or pharmacist experiences next.
          </p>
        </div>
        <UseCaseDeck />
      </section>

      <section className="patient-section section-pad" id="patient-view">
        <div className="patient-section__copy">
          <div className="section-kicker">
            <span className="section-number">02</span>
            <span>The patient view</span>
          </div>
          <h2>See the next step before it becomes <span>urgent.</span></h2>
          <p className="section-lede">
            A focused home screen keeps the next refill, reminder, pickup status,
            and pharmacist conversation in view without turning care into a feed.
          </p>
          <div className="patient-feature-list">
            <div className="patient-feature">
              <span className="patient-feature__icon">01</span>
              <span><strong>Next refill</strong><small>Know what is coming and when.</small></span>
            </div>
            <div className="patient-feature">
              <span className="patient-feature__icon">02</span>
              <span><strong>Quiet reminders</strong><small>Get a nudge three days early.</small></span>
            </div>
            <div className="patient-feature">
              <span className="patient-feature__icon">03</span>
              <span><strong>Direct chat</strong><small>Ask Mani about the active order.</small></span>
            </div>
          </div>
          <Link className="button button--dark" href="/login">
            Preview the patient view <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className="patient-preview" aria-label="Preview of the RefillRx patient dashboard">
          <div className="patient-preview__topbar">
            <span className="patient-preview__mini-brand"><MedicineMark /> refill<span>rx</span></span>
            <span className="patient-preview__notification">2</span>
          </div>
          <div className="patient-preview__greeting">
            <small>Tuesday, 11 Nov</small>
            <h3>Good morning, Amina.</h3>
          </div>
          <div className="patient-preview__next">
            <div>
              <small>Next refill</small>
              <strong>Amlodipine 5mg</strong>
              <span>Due in 6 days · Mani, Benin City</span>
            </div>
            <span className="status-pill status-pill--lime">Planned</span>
          </div>
          <div className="patient-preview__status">
            <div><span className="status-dot" />Reminder scheduled</div>
            <span>08 Nov</span>
          </div>
          <div className="chat-preview">
            <span className="chat-preview__avatar">MF</span>
            <span><small>New from Mani</small><strong>Your refill is ready for pickup.</strong></span>
            <span className="chat-preview__arrow" aria-hidden="true">↗</span>
          </div>
        </div>
      </section>

      <section className="trust-section section-pad" id="for-mani">
        <div className="trust-art">
          <Image
            src="/doodles/03-pharmacist-queue.svg"
            alt="Illustration of the pharmacist queue"
            width={600}
            height={600}
          />
          <span className="trust-art__label">Mani / 06:45</span>
        </div>
        <div className="trust-copy">
          <div className="section-kicker">
            <span className="section-number">03</span>
            <span>Made for the counter</span>
          </div>
          <h2>Less queue noise. More time for people.</h2>
          <p className="section-lede">
            Mani gets a focused refill queue, a clear patient conversation, and
            the context needed to confirm an order without exposing a public
            medicine price list.
          </p>
          <div className="stats-row">
            {stats.map(([value, label]) => (
              <div className="stat" key={value}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <Link className="button button--dark" href="/login">
            Open the pharmacist view <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <section className="faq-section section-pad" id="faq">
        <div>
          <div className="section-kicker">
            <span className="section-number">04</span>
            <span>Good to know</span>
          </div>
          <h2>Clear answers before you <span>start.</span></h2>
        </div>
        <div className="faq-list">
          <details open>
            <summary>Are medicine prices shown publicly?</summary>
            <p>No. Mani confirms medicine availability and pricing privately when a refill order is reviewed.</p>
          </details>
          <details>
            <summary>What does the monthly service cover?</summary>
            <p>It covers refill planning, three-day reminders, order updates, and a direct conversation with Mani about an active order.</p>
          </details>
          <details>
            <summary>Can I use RefillRx for prescription medicines?</summary>
            <p>Yes, but prescription-required medicines are flagged for pharmacist review before the order is confirmed.</p>
          </details>
        </div>
      </section>

      <section className="service-section section-pad">
        <div className="service-card">
          <div>
            <p className="eyebrow">A simple monthly service</p>
            <h2>
              Keep the next refill <em>within reach.</em>
            </h2>
          </div>
          <div className="service-card__right">
            <p>
              Start with a refill plan today. Mani will confirm medication
              availability and pricing privately when your order is reviewed.
            </p>
            <Link className="button button--dark" href="/register">
              Get started <span aria-hidden="true">↗</span>
            </Link>
            <small>Monthly service fee details will be confirmed before payment.</small>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-brand">
          <Link className="brand-mark brand-mark--dark" href="#top">
            <MedicineMark />
            refill<span>rx</span>
          </Link>
          <p>Refill care, kept close.</p>
        </div>
        <div className="footer-location">
          <span>Community pharmacy</span>
          <strong>Mani, Benin City</strong>
        </div>
        <div className="footer-links">
          <Link href="/about">About</Link>
          <Link href="/pricing">Service fee</Link>
          <Link href="/login">Sign in</Link>
        </div>
      </footer>
    </main>
  );
}
