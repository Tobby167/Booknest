import { fail, ok, safeError } from "@/lib/api";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyPaymentReceipt } from "@/services/ai/paymentVerifier";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "receipt-upload"), 10, 60_000);
  if (!limit.allowed) return fail("Too many upload attempts. Please wait a moment and try again.", 429);

  const formData = await request.formData();
  const file = formData.get("file");
  const businessId = String(formData.get("businessId") || "");
  const appointmentId = String(formData.get("appointmentId") || "");
  const clientEmail = String(formData.get("clientEmail") || "").trim().toLowerCase();
  const clientPhone = String(formData.get("clientPhone") || "").replace(/\D/g, "");

  if (!(file instanceof File)) return fail("Receipt file is required.");
  if (!businessId) return fail("businessId is required.");
  if (!allowedTypes.has(file.type)) return fail("Receipt must be PNG, JPG, JPEG, or WebP.");
  if (file.size > maxBytes) return fail("Receipt must be 5 MB or smaller.");

  const supabase = await createSupabaseServerClient();
  const { data: business, error: businessError } = await supabase.from("businesses").select("id").eq("id", businessId).maybeSingle();
  if (businessError) return safeError();
  if (!business) return fail("Business not found.", 404);

  if (appointmentId) {
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id,business_id,client_email,client_phone")
      .eq("id", appointmentId)
      .maybeSingle();
    if (appointmentError) return safeError();
    if (!appointment || appointment.business_id !== businessId) return fail("Appointment not found.", 404);

    const emailMatches = appointment.client_email && clientEmail && appointment.client_email.trim().toLowerCase() === clientEmail;
    const phoneMatches = appointment.client_phone && clientPhone && appointment.client_phone.replace(/\D/g, "") === clientPhone;
    if (!emailMatches && !phoneMatches) return fail("Appointment contact verification failed.", 403);
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return fail("Receipt upload is not configured on the server.", 500);
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  if (!["png", "jpg", "jpeg", "webp"].includes(extension)) {
    return fail("Receipt file extension must be PNG, JPG, JPEG, or WebP.");
  }

  const objectPath = `${businessId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage.from("payment-receipts").upload(objectPath, file, {
    contentType: file.type,
    upsert: false
  });
  if (uploadError) return safeError();

  const { data } = admin.storage.from("payment-receipts").getPublicUrl(objectPath);
  const receiptUrl = data.publicUrl;

  if (appointmentId) {
    const { error } = await admin.rpc("attach_public_receipt", {
      p_appointment_id: appointmentId,
      p_receipt_image_url: receiptUrl
    });
    if (error) return safeError();

    // Trigger AI Payment Verification Agent asynchronously
    try {
      const { data: payment } = await admin
        .from("payments")
        .select("id")
        .eq("appointment_id", appointmentId)
        .maybeSingle();
      if (payment) {
        verifyPaymentReceipt(payment.id).catch(err => {
          console.error("AI receipt verification failed in background:", err);
        });
      }
    } catch (e) {
      console.error("Failed to trigger AI verifier:", e);
    }
  }

  return ok({ receiptUrl, objectPath });
}
