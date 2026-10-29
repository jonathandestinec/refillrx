"use client";

import { useEffect, useState } from "react";

import { reviewRefillOrder, updateRefillOrderStatus, type OrderStatusState } from "@/app/actions/refill-orders";
import { useActionState } from "react";
import { createClient } from "@/lib/supabase/client";

type OrderControlsProps = {
  orderId: string;
  status: string;
  availabilityConfirmed: boolean;
  privatePriceAmount: number | null;
  reviewedAt: string | null;
};

export default function OrderControls({ orderId, status, availabilityConfirmed, privatePriceAmount, reviewedAt }: OrderControlsProps) {
  const [statusState, statusAction, statusPending] = useActionState(updateRefillOrderStatus, null as OrderStatusState);
  const [liveOrder, setLiveOrder] = useState({ status, availabilityConfirmed, privatePriceAmount, reviewedAt });
  const [liveState, setLiveState] = useState<"connecting" | "connected" | "error">("connecting");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`refillrx-pharmacy-order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "refill_orders", filter: `id=eq.${orderId}` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const order = payload.new as { status?: string; availability_confirmed?: boolean; private_price_amount?: number | null; reviewed_at?: string | null };
          setLiveOrder({
            status: order.status ?? status,
            availabilityConfirmed: Boolean(order.availability_confirmed),
            privatePriceAmount: order.private_price_amount ?? null,
            reviewedAt: order.reviewed_at ?? null,
          });
        },
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") setLiveState("connected");
        if (subscriptionStatus === "CHANNEL_ERROR" || subscriptionStatus === "TIMED_OUT") setLiveState("error");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, status]);

  const nextStatus = liveOrder.status === "requested" ? "reviewing" : liveOrder.status === "reviewing" ? "ready" : "completed";
  const nextLabel = liveOrder.status === "requested" ? "Start review" : liveOrder.status === "reviewing" ? "Mark ready for pickup" : "Mark completed";
  const statusLabel = liveOrder.status === "ready" ? "Ready for pickup" : liveOrder.status === "reviewing" ? "In review" : "Requested";
  const reviewComplete = Boolean(liveOrder.reviewedAt && liveOrder.availabilityConfirmed && liveOrder.privatePriceAmount !== null);

  return (
    <>
      <div className="pharmacy-order-status">
        <span className={`status-pill ${liveOrder.status === "ready" ? "status-pill--lime" : "status-pill--yellow"}`}>{statusLabel}</span>
        <small className={`pharmacy-order-status__live pharmacy-order-status__live--${liveState}`}>{liveState === "connected" ? "Live" : liveState === "error" ? "Refresh needed" : "Connecting…"}</small>
      </div>
      <form className="pharmacy-review" action={reviewRefillOrder}>
        <div className="pharmacy-review__heading">
          <p className="eyebrow">Pharmacist review</p>
          <p>Confirm availability and the private medicine price before marking this request ready.</p>
        </div>
        <input type="hidden" name="order_id" value={orderId} />
        <label className="auth-field" htmlFor={`availability-${orderId}`}>
          <span>Availability</span>
          <select id={`availability-${orderId}`} name="availability" defaultValue={liveOrder.reviewedAt ? (liveOrder.availabilityConfirmed ? "confirmed" : "unavailable") : ""} required>
            <option value="" disabled>Choose a result</option>
            <option value="confirmed">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </label>
        <label className="auth-field" htmlFor={`price-${orderId}`}>
          <span>Private medicine price (NGN)</span>
          <input id={`price-${orderId}`} name="private_price_amount" type="number" min="0" step="1" defaultValue={liveOrder.privatePriceAmount ?? ""} placeholder="Enter confirmed price" required={liveOrder.availabilityConfirmed} />
        </label>
        <button className="button button--light" type="submit">Save private review</button>
      </form>
      <form className="pharmacy-queue__actions" action={statusAction}>
        <input type="hidden" name="order_id" value={orderId} />
        {nextStatus === "ready" && !reviewComplete ? <button className="button button--dark" disabled type="button">Save review before pickup</button> : <button className="button button--dark" name="status" value={nextStatus} type="submit" disabled={statusPending}>{statusPending ? "Saving…" : nextLabel} {!statusPending && <span aria-hidden="true">↗</span>}</button>}
        {liveOrder.status !== "ready" && <button className="text-button" name="status" value="cancelled" type="submit" disabled={statusPending}>Cancel request</button>}
      </form>
      {statusState?.message && <p className={statusState.success ? "order-chat__feedback" : "auth-error"} role="status">{statusState.message}</p>}
    </>
  );
}
