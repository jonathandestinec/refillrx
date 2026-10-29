import { connection } from "next/server";
import { NextResponse } from "next/server";

import { verifyAndActivatePayment } from "@/lib/paystack-server";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export async function POST(request: Request) {
  await connection();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id) return NextResponse.json({ message: "Sign in before verifying payment." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { reference?: unknown } | null;
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  if (!reference) return NextResponse.json({ message: "Payment reference is required." }, { status: 400 });

  try {
    const result = await verifyAndActivatePayment(userData.user.id, reference);
    if (result.ok) return NextResponse.json(result);
    return NextResponse.json(result, { status: result.status === "pending" ? 202 : 400 });
  } catch (error) {
    console.error("Paystack verification failed", error);
    return NextResponse.json({ status: "failed", message: "We could not verify this payment yet." }, { status: 502 });
  }
}
