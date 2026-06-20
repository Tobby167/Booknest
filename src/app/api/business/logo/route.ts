import { fail, getOwnedBusiness, ok, requireUser, safeError } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const allowedLogoTypes = ["image/png", "image/jpeg", "image/webp"];
const maxLogoBytes = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  if (!user) return fail("Authentication required.", 401);

  const business = await getOwnedBusiness(supabase);
  if (!business) return fail("Create your business profile before uploading a logo.", 400);

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Choose a logo file first.");

  if (!allowedLogoTypes.includes(file.type)) {
    return fail("Logo must be PNG, JPG, JPEG, or WebP.");
  }

  if (file.size > maxLogoBytes) {
    return fail("Logo must be 2 MB or smaller.");
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return fail("Logo upload is not configured on the server.", 500);
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  if (!["png", "jpg", "jpeg", "webp"].includes(extension)) {
    return fail("Logo file extension must be PNG, JPG, JPEG, or WebP.");
  }

  const path = `${business.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage.from("business-logos").upload(path, file, {
    contentType: file.type,
    upsert: false
  });

  if (uploadError) return safeError();

  const { data } = admin.storage.from("business-logos").getPublicUrl(path);
  const { data: updatedBusiness, error: updateError } = await supabase
    .from("businesses")
    .update({ logo_url: data.publicUrl })
    .eq("id", business.id)
    .select("*")
    .single();

  if (updateError) return safeError();

  return ok({ business: updatedBusiness, logoUrl: data.publicUrl });
}
