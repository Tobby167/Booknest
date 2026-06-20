"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSiteUrl } from "@/lib/env";

export function ForgotPasswordCard() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/reset-password`
    });
    setBusy(false);
    setMessage(error ? error.message : "Password reset email sent. Check your inbox.");
  }

  return (
    <div className="card mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-black text-ink">Reset password</h1>
      <form className="mt-6 grid gap-4" onSubmit={submit}>
        <label>
          <span className="label">Email</span>
          <input className="input focus-ring" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Sending..." : "Send reset link"}
        </button>
      </form>
      {message ? <p className="mt-4 rounded-lg bg-blush/60 p-3 text-sm font-bold text-ink">{message}</p> : null}
      <Link className="mt-5 inline-block text-sm font-bold" href="/login">
        Back to login
      </Link>
    </div>
  );
}
