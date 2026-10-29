"use client";

import { useActionState } from "react";

import { signIn } from "@/app/actions/auth";

export default function LoginForm({ initialMessage }: { initialMessage?: string }) {
  const [state, action, pending] = useActionState(signIn, initialMessage ? { message: initialMessage } : null);

  return (
    <form className="auth-form" action={action}>
      <div className="auth-field">
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="auth-field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.message && <p className="auth-error" role="alert">{state.message}</p>}
      <button className="button button--dark auth-submit" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
