"use client";

import { useActionState } from "react";
import { useEffect, useState } from "react";

import { sendOrderMessage, type MessageState } from "@/app/actions/refill-orders";
import { createClient } from "@/lib/supabase/client";

type OrderMessage = { id: string; sender_id: string; body: string; created_at: string };

export default function OrderChat({ orderId, viewerId, participantLabel, messages }: { orderId: string; viewerId: string; participantLabel: string; messages: OrderMessage[] }) {
  const [state, action, pending] = useActionState(sendOrderMessage, null as MessageState);
  const [liveMessages, setLiveMessages] = useState(messages);
  const [liveState, setLiveState] = useState<"connecting" | "connected" | "error">("connecting");

  useEffect(() => {
    setLiveMessages(messages);
  }, [messages]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`refillrx-chat-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "refill_order_messages", filter: `order_id=eq.${orderId}` },
        async () => {
          const { data } = await supabase
            .from("refill_order_messages")
            .select("id, sender_id, body, created_at")
            .eq("order_id", orderId)
            .order("created_at", { ascending: true });
          if (data) setLiveMessages(data);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveState("connected");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setLiveState("error");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId]);

  return (
    <section className="order-chat" aria-labelledby={`chat-${orderId}`}>
      <div className="order-chat__heading">
        <div>
          <p className="eyebrow">Conversation</p>
          <h3 id={`chat-${orderId}`}>Message about this refill</h3>
        </div>
        <span>{liveState === "connected" ? "Private · live" : "Private"}</span>
      </div>
      {liveMessages.length ? (
        <div className="order-chat__messages">
          {liveMessages.map((message) => {
            const mine = message.sender_id === viewerId;
            return (
              <div className={`order-chat__message-row${mine ? " order-chat__message-row--mine" : ""}`} key={message.id}>
                <span className="order-chat__message-meta">{mine ? "You" : participantLabel} · <time dateTime={message.created_at}>{new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(message.created_at))}</time></span>
                <p className={mine ? "order-chat__message order-chat__message--mine" : "order-chat__message"}>{message.body}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="order-chat__empty">No messages yet. Use this conversation for availability or pickup questions.</p>
      )}
      <form className="order-chat__form" action={action}>
        <input type="hidden" name="order_id" value={orderId} />
        <label className="sr-only" htmlFor={`message-${orderId}`}>Message</label>
        <textarea id={`message-${orderId}`} name="body" maxLength={1000} placeholder="Write a message about this refill" rows={2} required />
        <button className="button button--dark" type="submit" disabled={pending}>{pending ? "Sending…" : "Send message"}</button>
      </form>
      {state?.message && <p className="order-chat__feedback" role="status">{state.message}</p>}
    </section>
  );
}
