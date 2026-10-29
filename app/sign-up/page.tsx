import Link from "next/link";

import BrandMark from "../components/brand-mark";
import SignUpForm from "./sign-up-form";

export default function SignUpPage() {
  return (
    <main className="auth-shell">
      <BrandMark className="auth-brand" />
      <section className="auth-card" aria-labelledby="signup-title">
        <p className="eyebrow">Start your refill routine</p>
        <h1 id="signup-title">Keep the next refill within reach.</h1>
        <p className="auth-intro">Create a patient account to register a plan and stay connected to Mani.</p>
        <SignUpForm />
        <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
