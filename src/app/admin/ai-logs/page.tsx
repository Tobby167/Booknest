import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AILogViewer } from "@/components/admin/AILogViewer";

export const revalidate = 0; // Ensure live data always shows

export default async function AdminAILogsPage() {
  // Use admin client to bypass RLS since businesses own the conversations
  const adminClient = createSupabaseAdminClient();
  
  const { data: conversations } = await adminClient
    .from("chat_conversations")
    .select("*, business:businesses(name, slug)")
    .order("last_message_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-600">Super admin</p>
        <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">AI Assistant Logs</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">The AI Watcher: View live conversations between BookNest's AI Assistant and clients across all businesses.</p>
      </div>

      <AILogViewer conversations={conversations ?? []} />
    </div>
  );
}
