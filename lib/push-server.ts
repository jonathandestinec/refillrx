import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";

type PushPayload = {
  title: string;
  body: string;
  url: string;
};

type SupabaseClient = ReturnType<typeof createAdminClient>;

export async function notifyUser(userId: string, payload: PushPayload) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const admin = createAdminClient();
  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("patient_id", userId);

  if (error) {
    console.error("User push subscription lookup failed", { code: error.code, message: error.message });
    return;
  }

  await Promise.all((subscriptions ?? []).map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
      );
    } catch (sendError) {
      const statusCode = sendError && typeof sendError === "object" && "statusCode" in sendError ? sendError.statusCode : null;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
      } else {
        console.error("User push delivery failed", { statusCode, endpoint: subscription.endpoint.slice(0, 48) });
      }
    }
  }));
}

// The MVP has a single pharmacy with one pharmacist. Workflow code resolves
// the receiving pharmacist this way instead of storing per-order assignment.
export async function getPharmacistId(excludeUserId?: string) {
  const admin = createAdminClient();
  const query = admin.from("profiles").select("id").eq("role", "pharmacist").limit(1);
  const { data } = excludeUserId
    ? await query.neq("id", excludeUserId).maybeSingle<{ id: string }>()
    : await query.maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

// Records a notification row for activity logging and in-app history. Refill
// reminders are scheduled separately; every status update and chat message is
// logged here as sent.
export async function logNotification(
  admin: SupabaseClient,
  rec: { userId: string; title: string; body: string; type: "refill_reminder" | "order_update" | "message" | "plan_expired"; url: string },
) {
  const { error } = await admin.from("notifications").insert({
    patient_id: rec.userId,
    type: rec.type,
    title: rec.title,
    body: rec.body,
    data: { url: rec.url },
    scheduled_for: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    status: "sent",
  });
  if (error) {
    console.error("Notification logging failed", { code: error.code, message: error.message });
  }
}
