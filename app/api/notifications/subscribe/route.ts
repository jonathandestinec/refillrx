import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PushSubscriptionPayload = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const patientId = data?.claims?.sub;
  if (!patientId) return NextResponse.json({ message: "Sign in to enable notifications." }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as PushSubscriptionPayload | null;
  const endpoint = payload?.endpoint?.trim();
  const p256dh = payload?.keys?.p256dh?.trim();
  const auth = payload?.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth || endpoint.length > 2048) {
    return NextResponse.json({ message: "That notification subscription is invalid." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert({
    patient_id: patientId,
    endpoint,
    p256dh,
    auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: "patient_id,endpoint" });

  if (error) {
    console.error("Push subscription save failed", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    if (error.code === "PGRST205") {
      return NextResponse.json({ message: "Push reminders are not set up in Supabase yet. Apply the push subscriptions migration, then try again." }, { status: 503 });
    }
    return NextResponse.json({ message: "We could not enable notifications yet." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
