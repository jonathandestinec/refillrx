"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

// Keeps the notifications feed current: every insert or read-receipt for this
// signed-in account refreshes the server-rendered feed without a manual reload.
export default function LiveRefresh({ userId, channelName }: { userId: string; channelName?: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(channelName ?? `refillrx-live-feed-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `patient_id=eq.${userId}` },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `patient_id=eq.${userId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, channelName, router]);

  return null;
}
