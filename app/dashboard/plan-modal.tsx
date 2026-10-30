"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import NewPlanForm, { type MedicineOption } from "@/app/dashboard/plans/new/new-plan-form";

// Registration happens in a modal on the dashboard: the patient picks the
// medicine and routine, saves the draft, and is returned to the dashboard where
// the payment step waits. The /dashboard/plans/new page stays as the standalone
// route (used by the sidebar link and as a no-JS fallback).
export default function NewPlanModal({
  medicines,
  label = "Register a refill plan",
  className = "button button--dark",
}: {
  medicines: MedicineOption[];
  label?: string;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const close = () => setOpen(false);
  const handleSuccess = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  return (
    <>
      <button className={className} type="button" onClick={() => setOpen(true)}>
        {label} <span aria-hidden="true">↗</span>
      </button>
      <dialog
        className="plan-modal"
        ref={dialogRef}
        aria-labelledby="plan-modal-title"
        onCancel={(event) => {
          // Esc closes via the native event; intercept to keep React state in sync.
          event.preventDefault();
          close();
        }}
      >
        <div className="plan-modal__heading">
          <div>
            <p className="eyebrow">Register a refill plan</p>
            <h2 id="plan-modal-title">Save the routine once.</h2>
          </div>
          <button className="plan-modal__close" type="button" aria-label="Close" onClick={close}>
            ✕
          </button>
        </div>
        <p className="plan-modal__lede">
          Tell Mani what you take and when you expect to need it. Availability and pricing are confirmed privately after review.
        </p>
        {medicines.length === 0 ? (
          <div className="account-empty-state" role="alert">
            <strong>Medicine list unavailable.</strong>
            <span>Refresh the page and try again.</span>
          </div>
        ) : (
          <NewPlanForm medicines={medicines} onSuccess={handleSuccess} />
        )}
      </dialog>
    </>
  );
}
