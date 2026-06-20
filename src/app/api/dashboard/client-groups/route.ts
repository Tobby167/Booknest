import { z } from "zod";
import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";

const clientGroupSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().or(z.literal("")).nullable()
});

export async function POST(request: Request) {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const parsed = clientGroupSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid group.");

  const { data, error } = await supabase
    .from("client_groups")
    .insert({
      business_id: ownership.business.id,
      name: parsed.data.name.trim(),
      description: parsed.data.description || null
    })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);

  return ok({ group: data }, { status: 201 });
}
