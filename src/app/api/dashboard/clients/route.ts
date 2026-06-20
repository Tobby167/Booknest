import { z } from "zod";
import { fail, getOwnedBusiness, ok, requireOwnedBusiness, requireUser } from "@/lib/api";

const clientCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().or(z.literal("")).nullable(),
  client_type: z.enum(["regular", "new_client", "model", "special_person", "vip"]).default("regular"),
  is_approved: z.boolean().default(false),
  group_ids: z.array(z.string().uuid()).default([])
});

export async function GET() {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const business = await getOwnedBusiness(supabase);
  if (!business) return ok({ clients: [], groups: [] });

  const [clients, groups] = await Promise.all([
    supabase
      .from("clients")
      .select("*, appointments(id, appointment_date, start_time, status, total_price), client_group_members(client_group_id)")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false }),
    supabase.from("client_groups").select("*").eq("business_id", business.id).order("name")
  ]);
  if (clients.error) return fail(clients.error.message, 500);
  return ok({ clients: clients.data ?? [], groups: groups.error ? [] : groups.data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const parsed = clientCreateSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid client.");

  const { group_ids, ...clientPayload } = parsed.data;
  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      ...clientPayload,
      business_id: ownership.business.id,
      email: clientPayload.email || null,
      phone: clientPayload.phone || null
    })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);

  if (group_ids.length) {
    await supabase.from("client_group_members").insert(
      group_ids.map((groupId) => ({
        business_id: ownership.business.id,
        client_id: client.id,
        client_group_id: groupId
      }))
    );
  }

  return ok({ client }, { status: 201 });
}
