import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const errorUrl = new URL("/login", request.url);
      errorUrl.searchParams.set("message", "Your confirmation link could not be verified. Please try again.");
      return NextResponse.redirect(errorUrl);
    }
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
