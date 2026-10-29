import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";

type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export async function notifyPatient(patientId: string, payload: PushPayload) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const admin = createAdminClient();
  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("patient_id", patientId);

  if (error) {
    console.error("Patient push subscription lookup failed", { code: error.code, message: error.message });
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
        console.error("Patient push delivery failed", { statusCode, endpoint: subscription.endpoint.slice(0, 48) });
      }
    }
  }));
}
