"use client";

import { useActionState } from "react";

import { signUp, type AuthFormState } from "@/app/actions/auth";

const initialState: AuthFormState = null;

export default function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initialState);

  return (
    <form className="auth-form" action={action}>
      <div className="auth-field">
        <label htmlFor="name">Full name</label>
        <input id="name" name="name" type="text" autoComplete="name" required />
      </div>
      <div className="auth-field">
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="auth-field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {state?.message && <p className="auth-error" role="alert">{state.message}</p>}
      <button className="button button--dark auth-submit" disabled={pending} type="submit">
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
