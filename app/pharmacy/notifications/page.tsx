import { connection } from "next/server";
import { redirect } from "next/navigation";

import AccountNavigation from "@/app/components/account-navigation";
import LiveRefresh from "@/app/components/live-refresh";
import { markNotificationsRead } from "@/app/actions/notifications";
import { formatDate, formatDateTime } from "@/lib/date-format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const typeLabels = {
  refill_reminder: "Refill reminder",
  order_update: "Order update",
  message: "Message",
  plan_expired: "Plan ended",
} as const;

const stateByRow = (row: { status: string | null; scheduled_for: string | null }) => {
  if (row.status === "sent") return { label: "Delivered", className: "status-pill status-pill--lime" };
  if (row.status === "failed") return { label: "Delivery failed", className: "status-pill status-pill--red" };
  return { label: "Scheduled", className: "status-pill status-pill--yellow" };
};

export default async function PharmacyNotificationsPage() {
  await connection();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const pharmacistId = claimsData?.claims?.sub;

  if (!pharmacistId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", pharmacistId).maybeSingle();
  if (profile?.role !== "pharmacist") redirect("/dashboard/notifications");

  const [{ data: notifications }, { data: unreadRows }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, status, scheduled_for, sent_at, read_at")
      .eq("patient_id", pharmacistId)
      .order("scheduled_for", { ascending: false })
      .limit(40),
    supabase.from("notifications").select("id").eq("patient_id", pharmacistId).is("read_at", null),
  ]);

  const unreadCount = unreadRows?.length ?? 0;
  const rows = notifications ?? [];

  return (
    <main className="account-shell">
      <a className="skip-link" href="#account-main">Skip to main content</a>
      <div className="account-app">
        <AccountNavigation role="pharmacist" userId={pharmacistId} unreadNotifications={unreadCount} />
        <LiveRefresh userId={pharmacistId} channelName="refillrx-pharmacy-notifications" />
        <section className="account-content account-content--pharmacist" id="account-main" tabIndex={-1}>
          <div className="account-intro">
            <p className="eyebrow">Notifications</p>
            <h1>Your RefillRx updates.</h1>
            <p className="account-lede">Every refill request alert and message notification, as delivered. Browser notifications are the faster channel; this feed keeps a record either way.</p>
          </div>
          <section className="account-history" aria-labelledby="notifications-title">
            <div className="account-history__heading">
              <div>
                <p className="eyebrow">Activity</p>
                <h2 id="notifications-title">Notification feed</h2>
              </div>
              {unreadCount > 0 && (
                <form action={markNotificationsRead}>
                  <button className="button button--light" type="submit">Mark all read ({unreadCount})</button>
                </form>
              )}
            </div>
            {rows.length ? (
              <ul className="notifications-feed">
                {rows.map((row) => {
                  const state = stateByRow(row);
                  const when = row.sent_at ?? row.scheduled_for;
                  return (
                    <li className={`notifications-feed__item${row.read_at ? "" : " notifications-feed__item--unread"}`} key={row.id}>
                      <div>
                        <div className="notifications-feed__top">
                          <span className="notifications-feed__type">{typeLabels[row.type as keyof typeof typeLabels] ?? "Update"}</span>
                          <span className={state.className}>{state.label}</span>
                          {!row.read_at && <span className="account-sidebar__unread" aria-label="Unread">new</span>}
                        </div>
                        <strong>{row.title}</strong>
                        <p>{row.body}</p>
                        {when && <time dateTime={when}>{row.status === "sent" ? `Delivered ${formatDateTime(when)}` : `Planned for ${formatDate(when)}`}</time>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="account-history__empty">Nothing yet. New refill request alerts land here the moment a patient asks for a refill.</p>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
