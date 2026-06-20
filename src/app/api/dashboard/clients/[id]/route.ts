import { z } from "zod";
import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";

type RouteContext = { params: Promise<{ id: string }> };

const clientUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().or(z.literal("")).nullable(),
  client_type: z.enum(["regular", "new_client", "model", "special_person", "vip"]).optional(),
  is_approved: z.boolean().optional(),
  group_ids: z.array(z.string().uuid()).optional()
});

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const parsed = clientUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid client update.");

  const { group_ids, ...clientPatch } = parsed.data;
  const cleanPatch = {
    ...clientPatch,
    ...(Object.hasOwn(clientPatch, "email") ? { email: clientPatch.email || null } : {}),
    ...(Object.hasOwn(clientPatch, "phone") ? { phone: clientPatch.phone || null } : {})
  };

  const { data, error } = await supabase
    .from("clients")
    .update(cleanPatch)
    .eq("id", id)
    .eq("business_id", ownership.business.id)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);
  if (group_ids) {
    await supabase.from("client_group_members").delete().eq("business_id", ownership.business.id).eq("client_id", id);
    if (group_ids.length) {
      await supabase.from("client_group_members").insert(
        group_ids.map((groupId) => ({
          business_id: ownership.business.id,
          client_id: id,
          client_group_id: groupId
        }))
      );
    }
  }
  return ok({ client: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const { error } = await supabase.from("clients").delete().eq("id", id).eq("business_id", ownership.business.id);
  if (error) return fail(error.message, 500);
  return ok({ success: true });
}
