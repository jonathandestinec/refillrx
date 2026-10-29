"use client";

import { useActionState } from "react";

import { saveRefillPlanDraft, type PlanDraftState } from "@/app/actions/refill-plan";
import { MONTHLY_PLAN_PAYMENT_LABEL } from "@/lib/payments";

export type MedicineOption = {
  id: string;
  name: string;
  brand: string | null;
  strength: string | null;
  dosage_form: string | null;
  pack_size: string | null;
  category: string | null;
  requires_prescription: boolean;
};

const initialState: PlanDraftState = null;

function getDefaultDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

export default function NewPlanForm({ medicines }: { medicines: MedicineOption[] }) {
  const [state, action, pending] = useActionState(saveRefillPlanDraft, initialState);

  return (
    <form className="plan-form" action={action}>
      <div className="plan-form__section">
        <div className="plan-form__section-heading">
          <span>01</span>
          <div>
            <strong>Choose the medicine</strong>
            <small>Prices are not displayed publicly.</small>
          </div>
        </div>
        <label className="auth-field" htmlFor="medicine_id">
          <span>Medicine</span>
          <select id="medicine_id" name="medicine_id" required defaultValue="">
            <option value="" disabled>Select a medicine</option>
            {medicines.map((medicine) => (
              <option key={medicine.id} value={medicine.id}>
                {medicine.name}{medicine.strength ? ` ${medicine.strength}` : ""} · {medicine.brand ?? "Generic"} · {medicine.dosage_form ?? "Medicine"}
              </option>
            ))}
          </select>
        </label>
        {medicines.length === 0 && <p className="plan-form__hint">No medicines are available yet.</p>}
      </div>

      <div className="plan-form__section">
        <div className="plan-form__section-heading">
          <span>02</span>
          <div>
            <strong>Set the routine</strong>
            <small>We will remind you three days before this date.</small>
          </div>
        </div>
        <div className="plan-form__grid">
          <label className="auth-field" htmlFor="frequency_days">
            <span>Refill frequency</span>
            <select id="frequency_days" name="frequency_days" defaultValue="30" required>
              <option value="28">Every 28 days</option>
              <option value="30">Every month</option>
              <option value="60">Every 2 months</option>
              <option value="90">Every 3 months</option>
            </select>
          </label>
          <label className="auth-field" htmlFor="next_refill_date">
            <span>Next refill date</span>
            <input id="next_refill_date" name="next_refill_date" type="date" min={new Date().toISOString().slice(0, 10)} defaultValue={getDefaultDate()} required />
          </label>
        </div>
      </div>

      <div className="plan-form__section">
        <div className="plan-form__section-heading">
          <span>03</span>
          <div>
            <strong>Add context for Mani</strong>
            <small>Optional information about this refill.</small>
          </div>
        </div>
        <label className="auth-field" htmlFor="instructions">
          <span>Instructions</span>
          <textarea id="instructions" name="instructions" maxLength={500} placeholder="Anything Mani should know about this refill?" rows={4} />
        </label>
      </div>

      <div className="plan-form__payment-note">
        <strong>Payment comes before activation.</strong>
        <span>The monthly service is {MONTHLY_PLAN_PAYMENT_LABEL}. Mani confirms availability and medicine pricing privately after your plan details are saved.</span>
      </div>

      {state?.message && <p className={state.success ? "plan-success" : "auth-error"} role="status">{state.message}</p>}
      <button className="button button--dark plan-submit" disabled={pending || medicines.length === 0} type="submit">
        {pending ? "Saving details…" : "Save refill details"}
      </button>
    </form>
  );
}
