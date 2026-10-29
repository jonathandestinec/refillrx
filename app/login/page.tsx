import { Suspense } from "react";
import Link from "next/link";

import BrandMark from "../components/brand-mark";
import LoginForm from "./login-form";

type LoginSearchParams = Promise<{ message?: string | string[] }>;

async function LoginFormWithMessage({ searchParams }: { searchParams: LoginSearchParams }) {
  const params = await searchParams;
  const message = Array.isArray(params.message) ? params.message[0] : params.message;

  return <LoginForm initialMessage={message} />;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  return (
    <main className="auth-shell">
      <BrandMark className="auth-brand" />
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">RefillRx account</p>
        <h1 id="login-title">Welcome back.</h1>
        <p className="auth-intro">Sign in to see your refill plan, messages, and pickup status.</p>
        <Suspense fallback={<LoginForm />}>
          <LoginFormWithMessage searchParams={searchParams} />
        </Suspense>
        <p className="auth-switch">New to RefillRx? <Link href="/sign-up">Create an account</Link></p>
      </section>
    </main>
  );
}
