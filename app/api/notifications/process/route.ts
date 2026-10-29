import webpush from "web-push";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendEmail } from "@/lib/resend-server";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

const maxAttempts = 3;

type NotificationRow = {
  id: string;
  patient_id: string;
  type: string;
  title: string;
  body: string;
  scheduled_for: string;
  data: { url?: string; attempts?: number } | null;
};

// Runs on the Vercel cron schedule. Delivers every due reminder by push and
// email; transient failures are marked failed and retried on later runs up to
// maxAttempts.
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  const canPush = Boolean(publicKey && privateKey && subject);
  if (!canPush && !emailConfigured()) {
    return NextResponse.json({ message: "Push delivery and email are both not configured." }, { status: 503 });
  }

  if (canPush) webpush.setVapidDetails(subject!, publicKey!, privateKey!);
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: notifications, error } = await admin
    .from("notifications")
    .select("id, patient_id, type, title, body, scheduled_for, data")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(50) as { data: NotificationRow[] | null; error: { code: string; message: string } | null };

  if (error) {
    console.error("Scheduled notification lookup failed", { code: error.code, message: error.message });
    return NextResponse.json({ message: "Could not load scheduled notifications." }, { status: 500 });
  }

  let sent = 0;
  for (const notification of notifications ?? []) {
    const attempts = notification.data?.attempts ?? 0;

    let delivered = false;
    if (canPush) {
      const { data: subscriptions } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("patient_id", notification.patient_id);
      for (const subscription of subscriptions ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            JSON.stringify({ title: notification.title, body: notification.body, url: notification.data?.url ?? "/dashboard" }),
          );
          delivered = true;
        } catch (sendError) {
          const statusCode = sendError && typeof sendError === "object" && "statusCode" in sendError ? sendError.statusCode : null;
          if (statusCode === 404 || statusCode === 410) {
            await admin.from("push_subscriptions").delete().eq("id", subscription.id);
          } else {
            console.error("Reminder push delivery failed", { statusCode, notificationId: notification.id });
          }
        }
      }
    }

    // Reminder emails go to the account email. Missing or unverified patient
    // email addresses should never block a push delivery result.
    if (!delivered && emailConfigured()) {
      try {
        const { data: user } = await admin.auth.admin.getUserById(notification.patient_id);
        const toEmail = user?.user?.email;
        if (toEmail) {
          const result = await sendEmail({ toEmail, title: notification.title, body: notification.body });
          if (result.sent) delivered = true;
          else console.error("Reminder email failed", { notificationId: notification.id, error: result.error });
        }
      } catch (lookupError) {
        console.error("Reminder email recipient lookup failed", { notificationId: notification.id, lookupError });
      }
    }

    const finalStatus = delivered ? "sent" : attempts + 1 >= maxAttempts ? "failed" : "scheduled";
    await admin.from("notifications").update({
      status: finalStatus,
      sent_at: delivered ? new Date().toISOString() : null,
      data: { ...(notification.data ?? {}), attempts: attempts + 1 },
    }).eq("id", notification.id);
    if (delivered) sent += 1;
  }

  return NextResponse.json({ processed: notifications?.length ?? 0, sent });
}
