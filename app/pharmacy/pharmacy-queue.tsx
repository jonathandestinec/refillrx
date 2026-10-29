"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/date-format";

import OrderControls from "./order-controls";

type Patient = { id: string; full_name: string | null };
type Medicine = { id: string; name: string; brand: string | null; strength: string | null; dosage_form: string | null };
type PharmacyOrder = {
  id: string;
  patient_id: string;
  medicine_id: string;
  status: string;
  patient_note: string | null;
  requested_for: string;
  requested_at: string;
  availability_confirmed: boolean;
  private_price_amount: number | null;
  private_price_currency: string | null;
  reviewed_at: string | null;
  patient?: Patient;
  medicine?: Medicine;
};

const openStatuses = ["requested", "reviewing", "ready"];

export default function PharmacyQueue({ initialOrders, initialHistory }: { initialOrders: PharmacyOrder[]; initialHistory: PharmacyOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [history, setHistory] = useState(initialHistory);
  const [liveState, setLiveState] = useState<"connecting" | "connected" | "error">("connecting");

  useEffect(() => {
    const supabase = createClient();
    const loadOrder = async (orderId: string): Promise<PharmacyOrder | null> => {
      const { data: order } = await supabase
        .from("refill_orders")
        .select("id, patient_id, medicine_id, status, patient_note, requested_for, requested_at, availability_confirmed, private_price_amount, private_price_currency, reviewed_at")
        .eq("id", orderId)
        .maybeSingle();
      if (!order || !openStatuses.includes(order.status)) return null;

      const [{ data: patient }, { data: medicine }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").eq("id", order.patient_id).maybeSingle(),
        supabase.from("medicines").select("id, name, brand, strength, dosage_form").eq("id", order.medicine_id).maybeSingle(),
      ]);

      return { ...order, patient: patient ?? undefined, medicine: medicine ?? undefined };
    };

    const channel = supabase
      .channel("refillrx-pharmacy-queue")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "refill_orders" }, (payload) => {
        const orderId = String(payload.new.id);
        void loadOrder(orderId).then((order) => {
          if (!order) return;
          setOrders((current) => current.some((item) => item.id === order.id) ? current : [...current, order].sort((a, b) => a.requested_at.localeCompare(b.requested_at)));
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "refill_orders" }, (payload) => {
        const orderId = String(payload.new.id);
        if (!openStatuses.includes(String(payload.new.status))) {
          setOrders((current) => {
            const completedOrder = current.find((item) => item.id === orderId);
            if (completedOrder) setHistory((currentHistory) => [{ ...completedOrder, ...payload.new } as PharmacyOrder, ...currentHistory.filter((item) => item.id !== orderId)].slice(0, 8));
            return current.filter((item) => item.id !== orderId);
          });
          return;
        }
        setOrders((current) => current.map((item) => item.id === orderId ? { ...item, ...payload.new } as PharmacyOrder : item));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "refill_orders" }, (payload) => {
        setOrders((current) => current.filter((item) => item.id !== String(payload.old.id)));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveState("connected");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setLiveState("error");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section className="pharmacy-queue" aria-labelledby="queue-title">
      <div className="pharmacy-queue__header">
        <div>
          <p className="eyebrow">Open requests</p>
          <h2 id="queue-title">Requests needing attention</h2>
        </div>
        <div className="pharmacy-queue__summary">
          <span className="queue-count">{orders.length} {orders.length === 1 ? "request" : "requests"}</span>
          <small className={`pharmacy-order-status__live pharmacy-order-status__live--${liveState}`}>
            {liveState === "connected" ? "Live queue" : liveState === "error" ? "Refresh needed" : "Connecting…"}
          </small>
        </div>
      </div>
      {orders.length ? orders.map((order) => (
        <article className="pharmacy-queue__item" key={order.id}>
          <div className="pharmacy-queue__topline">
            <div>
              <p className="eyebrow">Patient refill request</p>
              <h2>{order.medicine?.name ?? "Medicine unavailable"}{order.medicine?.strength ? ` ${order.medicine.strength}` : ""}</h2>
              <p>{order.medicine?.brand ?? "Medicine details"}{order.medicine?.dosage_form ? ` · ${order.medicine.dosage_form}` : ""}</p>
            </div>
          </div>
          <div className="pharmacy-queue__details">
            <div><small>Patient</small><strong>{order.patient?.full_name ?? "Patient record unavailable"}</strong></div>
            <div><small>Requested for</small><strong>{formatDate(order.requested_for)}</strong></div>
            <div><small>Requested</small><strong>{formatDate(order.requested_at)}</strong></div>
          </div>
          {order.patient_note && <p className="pharmacy-queue__instructions"><strong>Patient note</strong>{order.patient_note}</p>}
          <OrderControls orderId={order.id} status={order.status} availabilityConfirmed={order.availability_confirmed} privatePriceAmount={order.private_price_amount} reviewedAt={order.reviewed_at} />
        </article>
      )) : (
        <div className="account-empty-state">
          <p className="eyebrow">Open requests</p>
          <strong>The queue is empty.</strong>
          <span>New patient refill requests will appear here automatically.</span>
        </div>
      )}
      <section className="pharmacy-history" id="history" aria-labelledby="pharmacy-history-title">
          <div className="pharmacy-history__heading">
            <div>
              <p className="eyebrow">Recent outcomes</p>
              <h2 id="pharmacy-history-title">Completed requests</h2>
            </div>
            <span>Last {history.length}</span>
          </div>
          {history.length ? <div className="pharmacy-history__list">
            {history.map((order) => (
              <div className="pharmacy-history__item" key={order.id}>
                <div>
                  <strong>{order.medicine?.name ?? "Medicine unavailable"}{order.medicine?.strength ? ` ${order.medicine.strength}` : ""}</strong>
                  <span>{order.patient?.full_name ?? "Patient record unavailable"} · Requested {formatDate(order.requested_at)}</span>
                </div>
                <span className={`status-pill ${order.status === "completed" ? "status-pill--lime" : "status-pill--yellow"}`}>{order.status === "completed" ? "Completed" : "Cancelled"}</span>
              </div>
            ))}
          </div> : <p className="pharmacy-history__empty">Completed or cancelled requests will appear here.</p>}
      </section>
    </section>
  );
}
