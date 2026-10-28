import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="site-shell">
      <section className="offline-page">
        <p className="eyebrow">RefillRx · Offline mode</p>
        <h1>You’re offline, but your refill plan is still close.</h1>
        <p>
          Reconnect to view live order updates, chat with Mani, or request your
          next refill.
        </p>
        <Link className="button button--dark" href="/">
          Return home <span aria-hidden="true">↗</span>
        </Link>
      </section>
    </main>
  );
}
