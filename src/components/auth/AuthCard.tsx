"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSiteUrl } from "@/lib/env";

type AuthMode = "login" | "signup";

type AuthCardProps = {
  mode: AuthMode;
  role?: "business_owner" | "client";
  redirectTo?: string;
  title?: string;
  description?: string;
  signupRedirectTo?: string;
  createAccountHref?: string;
  loginHref?: string;
};

const ownerRoles = ["business_owner", "staff", "admin"];

function wrongRoleMessage(expectedRole: "business_owner" | "client") {
  return expectedRole === "client"
    ? "This account cannot use the client booking area yet."
    : "This email belongs to a client account. Use the client login page, or create a separate business owner account.";
}

export function AuthCard({
  mode,
  role = "business_owner",
  redirectTo = "/dashboard",
  title,
  description,
  signupRedirectTo,
  createAccountHref,
  loginHref
}: AuthCardProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo:
                role === "client"
                  ? `${getSiteUrl()}/client/login?next=${encodeURIComponent(signupRedirectTo ?? redirectTo ?? "/client/bookings")}`
                  : `${getSiteUrl()}${signupRedirectTo ?? "/login"}`,
              data: { full_name: fullName, role }
            }
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);

    if (result.error) {
      const friendlyMessage =
        mode === "signup" && result.error.message.toLowerCase().includes("already")
          ? "This email already has a BookNest login. Use the login page with this email instead."
          : result.error.message;
      setMessage(friendlyMessage);
      return;
    }

    if (mode === "signup") {
      if (result.data.session) {
        router.push(redirectTo);
        router.refresh();
        return;
      }
      setMessage("Check your email to confirm your BookNest account, then log in.");
      return;
    }

    const userId = result.data.user?.id;
    if (!userId) {
      setMessage("Login worked, but BookNest could not read your profile yet. Please try again.");
      return;
    }

    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (profileError || !profile?.role) {
      await supabase.auth.signOut();
      setMessage("BookNest could not verify this account role. Please try again or contact support.");
      return;
    }

    const allowed = role === "client" ? true : ownerRoles.includes(profile.role);
    if (!allowed) {
      await supabase.auth.signOut();
      setMessage(wrongRoleMessage(role));
      return;
    }

    if (profile.role === "admin") {
      router.push("/admin");
    } else {
      router.push(redirectTo);
    }
    router.refresh();
  }

  return (
    <div className="card mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-black text-ink">{title ?? (mode === "signup" ? "Create BookNest account" : "Login to BookNest")}</h1>
      <p className="mt-2 text-sm leading-6 text-ink/65">
        {description ?? "Supabase Auth handles email confirmation, password reset, and session management."}
      </p>
      <form className="mt-6 grid gap-4" onSubmit={submit}>
        {mode === "signup" ? (
          <label>
            <span className="label">Full name</span>
            <input className="input focus-ring" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
        ) : null}
        <label>
          <span className="label">Email</span>
          <input className="input focus-ring" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          <span className="label">Password</span>
          <input
            className="input focus-ring"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Please wait..." : mode === "signup" ? "Sign up" : "Login"}
        </button>
      </form>
      {message ? <p className="mt-4 rounded-lg bg-blush/60 p-3 text-sm font-bold text-ink">{message}</p> : null}
      <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm font-bold">
        {mode === "signup" ? (
          <Link href={loginHref ?? (role === "client" ? "/client/login" : "/login")}>Already have an account?</Link>
        ) : (
          <Link href={createAccountHref ?? (role === "client" ? "/client/signup" : "/signup")}>Create account</Link>
        )}
        <Link href="/forgot-password">Forgot password?</Link>
      </div>
    </div>
  );
}
