"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type RealtimeState = "connecting" | "connected" | "error";

type RealtimeOrderSyncProps = {
  patientId: string;
  orderId?: string | null;
  role: "patient" | "pharmacist";
};

export default function RealtimeOrderSync({ patientId, orderId, role }: RealtimeOrderSyncProps) {
  const router = useRouter();
  const [state, setState] = useState<RealtimeState>("connecting");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`refillrx-${role}-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "refill_orders",
          ...(role === "patient" ? { filter: `patient_id=eq.${patientId}` } : {}),
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "refill_order_messages",
          ...(orderId ? { filter: `order_id=eq.${orderId}` } : {}),
        },
        () => router.refresh(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setState("connected");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setState("error");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, patientId, role, router]);

  return (
    <p className={`realtime-status realtime-status--${state}`} role="status" aria-live="polite">
      <span aria-hidden="true" />
      {state === "connected" ? "Live updates on" : state === "error" ? "Live updates unavailable · refresh to see changes" : "Connecting live updates…"}
    </p>
  );
}
