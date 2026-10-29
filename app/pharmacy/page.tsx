import { connection } from "next/server";
import { redirect } from "next/navigation";

import BrandMark from "@/app/components/brand-mark";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function PharmacyPage() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) redirect("/login");

  const role = (claims.app_metadata as { role?: string } | undefined)?.role;
  if (role !== "pharmacist") redirect("/dashboard");

  return (
    <main className="account-shell">
      <header className="account-header">
        <BrandMark className="auth-brand" />
        <form action="/auth/signout" method="post">
          <button className="text-button" type="submit">Sign out</button>
        </form>
      </header>
      <section className="account-content">
        <p className="eyebrow">Mani · Pharmacist queue</p>
        <h1>Review the next request.</h1>
        <p className="account-lede">Requests, private availability confirmation, and patient messages will appear here.</p>
        <div className="account-empty-state">
          <strong>No refill requests yet.</strong>
          <span>The queue will stay empty until a patient submits a refill request.</span>
        </div>
      </section>
    </main>
  );
}
