import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BroadcastManager } from "@/components/admin/BroadcastManager";

export default async function AdminBroadcastsPage() {
  const supabase = await createSupabaseServerClient();
  
  const { data: broadcasts } = await supabase
    .from("admin_broadcasts")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-600">Super admin</p>
        <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">Global Megaphone</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">Manage platform-wide announcements that appear on every business dashboard.</p>
      </div>

      <BroadcastManager broadcasts={broadcasts ?? []} />
    </div>
  );
}
