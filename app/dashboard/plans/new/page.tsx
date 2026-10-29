import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import NewPlanForm, { type MedicineOption } from "./new-plan-form";
import BrandMark from "@/app/components/brand-mark";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function NewPlanPage() {
  await connection();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) redirect("/login");

  const { data: medicines, error } = await supabase
    .from("medicines")
    .select("id, name, brand, strength, dosage_form, pack_size, category, requires_prescription")
    .eq("active", true)
    .order("category")
    .order("name");

  const medicineOptions: MedicineOption[] = medicines ?? [];

  return (
    <main className="account-shell">
      <header className="account-header">
        <BrandMark className="auth-brand" />
        <Link className="text-button" href="/dashboard">Back to dashboard</Link>
      </header>
      <section className="plan-content">
        <div className="plan-heading">
          <p className="eyebrow">Register a refill plan</p>
          <h1>Save the routine once.</h1>
          <p className="account-lede">Tell Mani what you take and when you expect to need it. Availability and pricing are confirmed privately after review.</p>
        </div>
        {error ? (
          <div className="account-empty-state" role="alert">
            <strong>Medicine list unavailable.</strong>
            <span>Refresh the page and try again.</span>
          </div>
        ) : (
          <NewPlanForm medicines={medicineOptions} />
        )}
      </section>
    </main>
  );
}
