import { connection } from "next/server";
import { redirect } from "next/navigation";

import { verifyAndActivatePayment } from "@/lib/paystack-server";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export async function GET(request: Request) {
  await connection();
  const reference = new URL(request.url).searchParams.get("reference");
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (reference && userData.user?.id) {
    try {
      await verifyAndActivatePayment(userData.user.id, reference);
    } catch (error) {
      console.error("Paystack callback verification failed", error);
    }
  }

  redirect("/dashboard");
}
