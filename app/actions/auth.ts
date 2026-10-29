"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  message?: string;
  field?: "name" | "email" | "password";
} | null;

function getText(formData: FormData, key: string, trim = true) {
  const value = formData.get(key);
  return typeof value === "string" ? (trim ? value.trim() : value) : "";
}

export async function signIn(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = getText(formData, "email").toLowerCase();
  const password = getText(formData, "password", false);

  if (!email) return { field: "email", message: "Enter your email address." };
  if (!password) return { field: "password", message: "Enter your password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { message: "That email and password combination could not be verified." };
  }

  redirect("/dashboard");
}

export async function signUp(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = getText(formData, "name");
  const email = getText(formData, "email").toLowerCase();
  const password = getText(formData, "password", false);

  if (name.length < 2) return { field: "name", message: "Enter your full name." };
  if (!email) return { field: "email", message: "Enter your email address." };
  if (password.length < 8) {
    return { field: "password", message: "Use at least 8 characters for your password." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
    },
  });

  if (error) return { message: "We could not create that account. Please try again." };

  if (!data.session) {
    redirect("/login?message=Check your email to confirm your account.");
  }

  redirect("/dashboard");
}
