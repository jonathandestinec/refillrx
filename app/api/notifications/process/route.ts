import webpush from "web-push";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json({ message: "Push delivery is not configured." }, { status: 503 });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: notifications, error } = await admin
    .from("notifications")
    .select("id, patient_id, scheduled_for, type")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(50);

  if (error) {
    console.error("Scheduled notification lookup failed", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    return NextResponse.json({ message: "Could not load scheduled notifications." }, { status: 500 });
  }

  let sent = 0;
  for (const notification of notifications ?? []) {
    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("patient_id", notification.patient_id);

    let delivered = false;
    for (const subscription of subscriptions ?? []) {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({
          title: "RefillRx reminder",
          body: "Your next refill is due soon. Open RefillRx to review it.",
          url: "/dashboard",
        }));
        delivered = true;
      } catch (sendError) {
        const statusCode = sendError && typeof sendError === "object" && "statusCode" in sendError ? sendError.statusCode : null;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        }
      }
    }

    await admin.from("notifications").update({
      status: delivered ? "sent" : "failed",
      sent_at: delivered ? new Date().toISOString() : null,
    }).eq("id", notification.id);
    if (delivered) sent += 1;
  }

  return NextResponse.json({ processed: notifications?.length ?? 0, sent });
}
