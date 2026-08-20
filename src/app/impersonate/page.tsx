"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ImpersonateCallbackPage() {
  const [status, setStatus] = useState("Signing out of admin session...");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function handleImpersonation() {
      // Step 1: Extract the token from the URL hash BEFORE doing anything else
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace("#", "?"));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken || !refreshToken) {
        // No tokens in URL - something went wrong, go back
        window.location.href = "/admin/businesses";
        return;
      }

      // Step 2: Sign out of the current admin session
      setStatus("Clearing admin session...");
      await supabase.auth.signOut();

      // Step 3: Set the new session using the tokens from the magic link
      setStatus("Signing in as business owner...");
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error("Impersonation error:", error);
        window.location.href = "/admin/businesses";
        return;
      }

      // Step 4: Hard redirect so the server picks up the new session cookies
      setStatus("Opening their dashboard...");
      window.location.href = "/dashboard";
    }

    handleImpersonation();
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600"></div>
        <p className="mt-4 font-bold text-ink/60">{status}</p>
      </div>
    </div>
  );
}
