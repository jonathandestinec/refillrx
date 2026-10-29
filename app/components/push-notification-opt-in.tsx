"use client";

import { useState, useSyncExternalStore } from "react";

function decodeBase64Url(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

const subscribeToBrowser = () => () => undefined;
const getBrowserSupport = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
const getServerSupport = () => false;

export default function PushNotificationOptIn() {
  const [state, setState] = useState<"idle" | "enabling" | "enabled" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const supported = useSyncExternalStore(subscribeToBrowser, getBrowserSupport, getServerSupport);
  const vapidPublicKey = publicKey;

  if (!supported || !vapidPublicKey) return null;

  async function enableNotifications() {
    setState("enabling");
    setErrorMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("error");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeBase64Url(vapidPublicKey!) });
      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(result?.message ?? "We could not save the notification subscription.");
      }
      setState("enabled");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Notifications were not enabled.");
      setState("error");
    }
  }

  return (
    <aside className="notification-opt-in" aria-live="polite">
      <div>
        <strong>Get refill reminders</strong>
        <p>Allow browser notifications so RefillRx can remind you three days before your next refill.</p>
      </div>
      {state === "enabled" ? <span className="notification-opt-in__success">Reminders enabled</span> : <button className="button button--light" type="button" onClick={() => void enableNotifications()} disabled={state === "enabling"}>{state === "enabling" ? "Enabling…" : "Enable reminders"}</button>}
      {state === "error" && <small className="notification-opt-in__error">{errorMessage || "Notifications were not enabled. Check your browser permission and try again."}</small>}
    </aside>
  );
}
