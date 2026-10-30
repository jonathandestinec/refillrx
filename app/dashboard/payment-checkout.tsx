"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MONTHLY_PLAN_PAYMENT_LABEL } from "@/lib/payments";

declare global {
  interface Window {
    PaystackPop?: new () => {
      resumeTransaction: (accessCode: string) => void;
    };
  }
}

type CheckoutState = "idle" | "initializing" | "checkout" | "verifying" | "success" | "cancelled" | "error";

export default function PaymentCheckout({ configured, failedBefore = false }: { configured: boolean; failedBefore?: boolean }) {
  const router = useRouter();
  const [scriptReady, setScriptReady] = useState(false);
  const [state, setState] = useState<CheckoutState>(failedBefore ? "error" : "idle");
  const [message, setMessage] = useState(failedBefore ? "The previous payment did not complete. You can try again." : "");
  const [paymentReference, setPaymentReference] = useState<string | null>(null);

  async function verify(reference: string, attempts = 0): Promise<void> {
    setState("verifying");
    try {
      const response = await fetch("/api/payments/paystack/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const result = (await response.json().catch(() => null)) as { status?: string; message?: string } | null;

      if (response.ok && result?.status === "succeeded") {
        setState("success");
        setMessage("Payment confirmed. Your refill plan is now active.");
        router.replace("/dashboard");
        return;
      }

      if ((response.status === 202 || result?.status === "pending") && attempts < 24) {
        window.setTimeout(() => void verify(reference, attempts + 1), 2500);
        return;
      }

      setState("error");
      setMessage(
        response.status === 202 || result?.status === "pending"
          ? "Payment is still processing. Check its status again before starting another payment."
          : result?.message ?? "We could not confirm the payment. Check its status before trying again.",
      );
    } catch {
      setState("error");
      setMessage("We could not check the payment status. Check again before starting another payment.");
    }
  }

  async function startPayment() {
    if (paymentReference) {
      await verify(paymentReference);
      return;
    }

    setState("initializing");
    setMessage("");
    try {
      const response = await fetch("/api/payments/paystack/initialize", { method: "POST" });
      const result = (await response.json().catch(() => null)) as { accessCode?: string; authorizationUrl?: string; reference?: string; message?: string } | null;

      if (!response.ok || !result?.accessCode || !result.reference) {
        setState("error");
        setMessage(result?.message ?? "We could not start payment. Please try again.");
        return;
      }
      setPaymentReference(result.reference);

      if (!scriptReady || !window.PaystackPop) {
        if (result.authorizationUrl) window.location.assign(result.authorizationUrl);
        else {
          setState("error");
          setMessage("Checkout is still loading. Please try again.");
        }
        return;
      }

      setState("checkout");
      const popup = new window.PaystackPop();
      popup.resumeTransaction(result.accessCode);
      const reference = result.reference;
      window.setTimeout(() => void verify(reference), 4000);
    } catch {
      setState("error");
      setMessage("We could not start checkout. Please try again.");
    }
  }

  const busy = state === "initializing" || state === "checkout" || state === "verifying";

  return (
    <div className="payment-checkout">
      {configured && <Script src="https://js.paystack.co/v2/inline.js" strategy="afterInteractive" onReady={() => setScriptReady(true)} />}
      {configured ? (
        <button className="button button--dark" type="button" onClick={() => void startPayment()} disabled={busy}>
          {state === "initializing" ? "Preparing payment…" : state === "checkout" ? "Checkout open…" : state === "verifying" ? "Confirming payment…" : paymentReference ? "Check payment status" : `Pay ${MONTHLY_PLAN_PAYMENT_LABEL} and activate plan`}
          <span aria-hidden="true">↗</span>
        </button>
      ) : null}
      <p className={`payment-checkout__message payment-checkout__message--${state}`} role="status" aria-live="polite">
        {!configured ? "Test-mode payment is not connected in this environment yet. Your saved details are safe; activation will be available once checkout is configured." : message || "Secure test-mode checkout. Your plan activates only after Paystack confirms the payment."}
      </p>
    </div>
  );
}
