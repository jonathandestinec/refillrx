"use client";

import { useActionState } from "react";
import { useEffect, useState } from "react";

import { requestRefill, type RefillOrderState } from "@/app/actions/refill-orders";
import { createClient } from "@/lib/supabase/client";

const initialState: RefillOrderState = null;

export default function RequestRefill({ planId, status, price, currency }: { planId: string; status?: string | null; price?: number | null; currency?: string | null }) {
  const [state, action, pending] = useActionState(requestRefill, initialState);
  const [liveOrder, setLiveOrder] = useState({ status, price, currency });
  const [liveState, setLiveState] = useState<"connecting" | "connected" | "error">("connecting");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`refillrx-plan-${planId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "refill_orders", filter: `plan_id=eq.${planId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setLiveOrder({ status: null, price: null, currency: null });
            return;
          }
          const order = payload.new as { status?: string; private_price_amount?: number | null; private_price_currency?: string | null };
          setLiveOrder({ status: order.status ?? null, price: order.private_price_amount ?? null, currency: order.private_price_currency ?? null });
        },
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") setLiveState("connected");
        if (subscriptionStatus === "CHANNEL_ERROR" || subscriptionStatus === "TIMED_OUT") setLiveState("error");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [planId]);

  if (liveOrder.status) {
    const label = liveOrder.status === "ready" ? "Ready for pickup" : liveOrder.status === "reviewing" ? "Being reviewed" : liveOrder.status === "completed" ? "Completed" : liveOrder.status === "cancelled" ? "Cancelled" : "Request sent";
    const message = liveOrder.status === "ready" && liveOrder.price !== null && liveOrder.price !== undefined
      ? `Your medicine is ready. Confirmed medicine price: ${liveOrder.currency === "NGN" ? "₦" : ""}${liveOrder.price.toLocaleString()}.`
      : liveOrder.status === "ready"
        ? "Your medicine is ready for pickup. Message Mani if you need to confirm anything."
        : liveOrder.status === "reviewing"
          ? "Mani is reviewing availability and private pricing."
          : liveOrder.status === "completed"
            ? "This refill was completed."
            : liveOrder.status === "cancelled"
              ? "This refill request was cancelled."
              : "Mani has received your request and will review it privately.";
    return <p className="refill-request-status" role="status"><strong>{label}</strong><span>{message}</span><small className={`refill-request-status__live refill-request-status__live--${liveState}`}>{liveState === "connected" ? "Updates appear automatically." : liveState === "error" ? "Refresh to check for updates." : "Connecting to live updates…"}</small></p>;
  }

  return (
    <div className="refill-request">
      <form action={action}>
        <input type="hidden" name="plan_id" value={planId} />
        <button className="button button--dark" disabled={pending} type="submit">
          {pending ? "Sending request…" : "Request this refill"} <span aria-hidden="true">↗</span>
        </button>
      </form>
      {state?.message && <p className={state.success ? "refill-request-status" : "auth-error"} role="status">{state.message}</p>}
    </div>
  );
}
