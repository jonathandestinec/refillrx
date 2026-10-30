"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import BrandMark from "./brand-mark";
import { createClient } from "@/lib/supabase/client";

type AccountRole = "patient" | "pharmacist";

const navigation: Record<AccountRole, Array<{ href: string; label: string; badge?: "notifications" | "messages" }>> = {
  patient: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/plans/new", label: "New refill plan" },
    { href: "/dashboard/notifications", label: "Notifications", badge: "notifications" },
    { href: "/dashboard/messages", label: "Messages", badge: "messages" },
    { href: "/dashboard#history", label: "Refill history" },
  ],
  pharmacist: [
    { href: "/pharmacy", label: "Queue" },
    { href: "/pharmacy/notifications", label: "Notifications", badge: "notifications" },
    { href: "/pharmacy/messages", label: "Messages", badge: "messages" },
    { href: "/pharmacy#history", label: "Recent outcomes" },
  ],
};

type BadgeKind = "notifications" | "messages";
type NavigationItem = { href: string; label: string; badge?: BadgeKind };

export default function AccountNavigation({
  role,
  userId,
  unreadMessages = 0,
  unreadNotifications = 0,
}: {
  role: AccountRole;
  userId: string;
  unreadMessages?: number;
  unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const items: NavigationItem[] = navigation[role];

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const refreshCounts = () => {
      // Server render computes each count from policies; this refreshes the
      // whole route payload so sidebar badges stay exact.
      router.refresh();
    };
    const channel = supabase
      .channel(`refillrx-badges-${role}-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `patient_id=eq.${userId}` },
        refreshCounts,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `patient_id=eq.${userId}` },
        () => refreshCounts(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "refill_order_messages" },
        refreshCounts,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "refill_order_messages" },
        () => refreshCounts(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, role, router]);

  return (
    <aside className="account-sidebar">
      <div className="account-sidebar__brand">
        <BrandMark className="brand-mark--dark" />
        <span>{role === "patient" ? "Patient account" : "Pharmacy workspace"}</span>
      </div>
      <nav className="account-sidebar__nav" aria-label={`${role} navigation`}>
        <p className="account-sidebar__label">Workspace</p>
        {items.map((item) => {
          const itemPath = item.href.split("#")[0];
          const active = !item.href.includes("#") && pathname === itemPath;
          const liveCount = item.badge === "notifications" ? unreadNotifications : unreadMessages;
          const showBadge = item.badge && liveCount > 0;
          return (
            <Link className={`account-sidebar__link${active ? " account-sidebar__link--active" : ""}`} href={item.href} key={item.href} aria-current={active ? "page" : undefined}>
              <span aria-hidden="true" className="account-sidebar__link-dot" />
              <span>{item.label}</span>
              {showBadge && <span className="account-sidebar__unread" aria-label={`${liveCount} unread ${item.badge === "messages" ? (liveCount === 1 ? "message" : "messages") : liveCount === 1 ? "notification" : "notifications"}`}>{liveCount}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="account-sidebar__footer">
        <div>
          <span className="account-sidebar__label">Pharmacy</span>
          <strong>Mani, Benin City</strong>
        </div>
        <form action="/auth/signout" method="post">
          <button className="text-button" type="submit">Sign out</button>
        </form>
      </div>
    </aside>
  );
}
