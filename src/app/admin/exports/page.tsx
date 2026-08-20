import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExportActions } from "@/components/admin/ExportActions";

export default async function AdminExportsPage() {
  const supabase = await createSupabaseServerClient();
  
  // Fetch everything for the CSV exports
  const [
    { data: businesses },
    { data: profiles },
    { data: appointments }
  ] = await Promise.all([
    supabase.from("businesses").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("appointments").select("*").order("appointment_date", { ascending: false })
  ]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-600">Super admin</p>
        <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">Data Exports</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">Download raw data from the platform into CSV format for offline analysis or backups.</p>
      </div>

      <ExportActions 
        businesses={businesses ?? []} 
        users={profiles ?? []} 
        appointments={appointments ?? []} 
      />
    </div>
  );
}
