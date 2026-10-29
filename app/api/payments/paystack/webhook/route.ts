import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { verifyAndActivatePayment } from "@/lib/paystack-server";

export const instant = false;

// Paystack signs every webhook POST with HMAC-SHA512 of the raw body using the
// secret key. Verifying it is what proves the request came from Paystack.
function signatureValid(rawBody: string, signature: string | null) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const provided = Buffer.from(signature, "utf8");
  const known = Buffer.from(expected, "utf8");
  return provided.length === known.length && timingSafeEqual(provided, known);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!signatureValid(rawBody, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ message: "Rejected." }, { status: 401 });
  }

  const event = (JSON.parse(rawBody) as { event?: string; data?: { reference?: string } } | null);
  const reference = event?.data?.reference?.trim();

  if (event?.event === "charge.success" && reference) {
    try {
      // The webhook does not know which patient made the payment; ownership is
      // enforced during the browser verify flow. Here we reconcile the record
      // so a patient who closed their browser still gets activated.
      await verifyAndActivatePayment(null, reference);
    } catch (error) {
      console.error("Paystack webhook verification failed", error);
    }
  } else if (event?.event === "charge.failed" && reference) {
    try {
      const { markPaymentFailed } = await import("@/lib/paystack-server");
      await markPaymentFailed(reference);
    } catch (error) {
      console.error("Paystack webhook failure marking failed", error);
    }
  }

  return NextResponse.json({ ok: true });
}
