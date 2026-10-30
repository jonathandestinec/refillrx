"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import BrandMark from "./brand-mark";

type AccountRole = "patient" | "pharmacist";

const navigation = {
  patient: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/plans/new", label: "New refill plan" },
    { href: "/dashboard/notifications", label: "Notifications" },
    { href: "/dashboard/messages", label: "Messages" },
    { href: "/dashboard#history", label: "Refill history" },
  ],
  pharmacist: [
    { href: "/pharmacy", label: "Queue" },
    { href: "/pharmacy/messages", label: "Messages" },
    { href: "/pharmacy#history", label: "Recent outcomes" },
  ],
} satisfies Record<AccountRole, Array<{ href: string; label: string }>>;

export default function AccountNavigation({ role, unreadMessages = 0 }: { role: AccountRole; unreadMessages?: number }) {
  const pathname = usePathname();

  return (
    <aside className="account-sidebar">
      <div className="account-sidebar__brand">
        <BrandMark className="brand-mark--dark" />
        <span>{role === "patient" ? "Patient account" : "Pharmacy workspace"}</span>
      </div>
      <nav className="account-sidebar__nav" aria-label={`${role} navigation`}>
        <p className="account-sidebar__label">Workspace</p>
        {navigation[role].map((item) => {
          const itemPath = item.href.split("#")[0];
          const active = !item.href.includes("#") && pathname === itemPath;
          const showBadge = unreadMessages > 0 && itemPath.endsWith("messages");
          return (
            <Link className={`account-sidebar__link${active ? " account-sidebar__link--active" : ""}`} href={item.href} key={item.href} aria-current={active ? "page" : undefined}>
              <span aria-hidden="true" className="account-sidebar__link-dot" />
              <span>{item.label}</span>
              {showBadge && <span className="account-sidebar__unread" aria-label={`${unreadMessages} unread ${unreadMessages === 1 ? "message" : "messages"}`}>{unreadMessages}</span>}
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
