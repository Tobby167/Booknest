"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.signOut().then(() => {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/login";
      router.replace(safeNext);
      router.refresh();
    });
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="card p-6 text-center font-black text-ink">Signing out...</div>
    </main>
  );
}
