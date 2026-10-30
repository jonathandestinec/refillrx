"use client";

import { useActionState } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { markOrderMessagesRead, sendOrderMessage, type MessageState } from "@/app/actions/refill-orders";
import { formatDateTime } from "@/lib/date-format";
import { createClient } from "@/lib/supabase/client";

type OrderMessage = { id: string; sender_id: string; body: string; created_at: string };

export default function OrderChat({ orderId, viewerId, participantLabel, messages }: { orderId: string; viewerId: string; participantLabel: string; messages: OrderMessage[] }) {
  const [state, action, pending] = useActionState(sendOrderMessage, null as MessageState);
  const [liveMessages, setLiveMessages] = useState<OrderMessage[]>([]);
  const [liveState, setLiveState] = useState<"connecting" | "connected" | "error">("connecting");
  const messageListRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  const displayedMessages = useMemo(() => {
    const merged = new Map(messages.map((message) => [message.id, message]));
    for (const message of liveMessages) merged.set(message.id, message);
    if (state?.sentMessage) merged.set(state.sentMessage.id, state.sentMessage);
    return [...merged.values()].sort((first, second) => first.created_at.localeCompare(second.created_at));
  }, [messages, liveMessages, state]);

  useEffect(() => {
    const formData = new FormData();
    formData.set("order_id", orderId);
    void markOrderMessagesRead(formData);
  }, [orderId, displayedMessages.length]);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (messageList) messageList.scrollTop = messageList.scrollHeight;
  }, [displayedMessages.length]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`refillrx-chat-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "refill_order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          if (payload.eventType !== "INSERT") return;
          const message = payload.new as OrderMessage & { order_id?: string };
          if (message.order_id !== orderId) return;
          setLiveMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
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

  useEffect(() => {
    if (!state?.success) return;
    if (messageInputRef.current) messageInputRef.current.value = "";
  }, [orderId, state]);

  return (
    <section className="order-chat" aria-labelledby={`chat-${orderId}`}>
      <div className="order-chat__heading">
        <div>
          <p className="eyebrow">Conversation</p>
          <h3 id={`chat-${orderId}`}>Message about this refill</h3>
        </div>
        <span aria-live="polite">{liveState === "connected" ? "Private · live" : liveState === "error" ? "Private · live updates unavailable" : "Private · connecting"}</span>
      </div>
      {displayedMessages.length ? (
        <div className="order-chat__messages" aria-live="polite" ref={messageListRef}>
          {displayedMessages.map((message) => {
            const mine = message.sender_id === viewerId;
            return (
              <div className={`order-chat__message-row${mine ? " order-chat__message-row--mine" : ""}`} key={message.id}>
                <span className="order-chat__message-meta">{mine ? "You" : participantLabel} · <time dateTime={message.created_at}>{formatDateTime(message.created_at)}</time></span>
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
        <textarea id={`message-${orderId}`} name="body" maxLength={1000} placeholder="Write a message about this refill" rows={2} ref={messageInputRef} required />
        <button className="button button--dark" type="submit" disabled={pending}>{pending ? "Sending…" : "Send message"}</button>
      </form>
      {state?.message && <p className={state.success ? "order-chat__feedback" : "auth-error"} role="status">{state.message}</p>}
    </section>
  );
}
