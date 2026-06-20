"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ResetPasswordCard() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="card mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-black text-ink">Choose a new password</h1>
      <form className="mt-6 grid gap-4" onSubmit={submit}>
        <label>
          <span className="label">New password</span>
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
          {busy ? "Updating..." : "Update password"}
        </button>
      </form>
      {message ? <p className="mt-4 rounded-lg bg-blush/60 p-3 text-sm font-bold text-ink">{message}</p> : null}
    </div>
  );
}
