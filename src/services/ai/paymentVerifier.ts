import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "",
});

type VerificationResult = {
  ai_status: "verified" | "flagged" | "failed";
  ai_report: any;
};

export async function verifyPaymentReceipt(paymentId: string): Promise<VerificationResult> {
  const admin = createSupabaseAdminClient();

  // 1. Update status to checking
  await admin
    .from("payments")
    .update({ ai_status: "checking" })
    .eq("id", paymentId);

  try {
    // 2. Fetch payment and business details
    const { data: payment, error: payError } = await admin
      .from("payments")
      .select("id, amount, receipt_image_url, business_id, appointment_id")
      .eq("id", paymentId)
      .maybeSingle();

    if (payError || !payment) {
      throw new Error(`Failed to resolve payment: ${payError?.message || "Not found"}`);
    }

    if (!payment.receipt_image_url) {
      throw new Error("No receipt image url attached to this payment.");
    }

    const { data: business, error: bizError } = await admin
      .from("businesses")
      .select("bank_name, bank_account_name, bank_account_number")
      .eq("id", payment.business_id)
      .maybeSingle();

    if (bizError || !business) {
      throw new Error(`Failed to resolve business settings: ${bizError?.message || "Not found"}`);
    }

    // 3. Extract path from receipt_image_url
    // Format is typically: .../storage/v1/object/public/payment-receipts/{businessId}/{uuid}.{ext}
    const parts = payment.receipt_image_url.split("/payment-receipts/");
    if (parts.length < 2) {
      throw new Error("Invalid receipt image URL format.");
    }
    const storagePath = parts[1];

    // 4. Download file from storage
    const { data: fileData, error: downloadError } = await admin.storage
      .from("payment-receipts")
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download receipt from storage: ${downloadError?.message || "No data"}`);
    }

    // 5. Convert file to base64
    const buffer = await fileData.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString("base64");
    const mimeType = fileData.type || "image/jpeg";

    // 6. Invoke Groq Qwen Vision Model
    const systemPrompt = `You are an AI Bank Transfer Receipt auditor for BookNest. Your job is to extract payment information from the uploaded receipt image and return a structured JSON response.

You must respond ONLY with a raw JSON object containing the following keys (do not include markdown backticks or formatting, just raw JSON text):
{
  "transactionRef": "reference number or transaction ID or session ID",
  "amount": 15000, // numeric value of the total transferred amount, or null
  "date": "YYYY-MM-DD or null",
  "recipient": "recipient account number/name or details or null",
  "sender": "sender name or null",
  "bank": "bank name or null",
  "suspectedTampering": false, // true if you detect mismatched fonts, weird alignments, edited text, or duplicate layout overlays
  "notes": "Brief summary of observations"
}`;

    const { text } = await generateText({
      model: groq("qwen/qwen3.6-27b"),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Audit this bank transfer receipt:" },
            {
              type: "image",
              image: base64Image,
              mimeType: mimeType,
            },
          ],
        },
      ],
    });

    let cleanText = text.trim();

    // Strip Qwen <think>...</think> reasoning blocks (may span multiple lines)
    cleanText = cleanText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // Strip markdown code fences: ```json ... ```
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    }

    // Extract the first {...} JSON object in case there's prose around it
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in model response");
    cleanText = jsonMatch[0];

    const extracted = JSON.parse(cleanText);

    // 7. Perform verification checks
    // Check A: Amount Match
    const expectedAmount = Number(payment.amount || 0);
    const extractedAmount = extracted.amount ? Number(extracted.amount) : 0;
    const amountMatches = Math.abs(extractedAmount - expectedAmount) < 1.0;

    // Check B: Deduplication (Reference is Unique)
    const ref = extracted.transactionRef ? String(extracted.transactionRef).trim() : null;
    let isDuplicate = false;
    if (ref) {
      const { data: dupPayments, error: dupError } = await admin
        .from("payments")
        .select("id")
        .eq("business_id", payment.business_id)
        .neq("id", paymentId)
        .eq("ai_report->extracted->>transactionRef", ref)
        .limit(1);

      if (!dupError && dupPayments && dupPayments.length > 0) {
        isDuplicate = true;
      }
    }

    // Check C: Recipient Match
    let recipientMatches = true;
    const bizAccNum = business.bank_account_number?.trim();
    if (bizAccNum && extracted.recipient) {
      const cleanExtractedRecip = String(extracted.recipient).toLowerCase();
      recipientMatches = cleanExtractedRecip.includes(bizAccNum.toLowerCase());
    }

    // Check D: Tampering
    const noTampering = !extracted.suspectedTampering;

    // 8. Decide status
    const allChecksPassed = amountMatches && !isDuplicate && recipientMatches && noTampering;
    const ai_status = allChecksPassed ? "verified" : "flagged";

    const ai_report = {
      extracted,
      checks: {
        amountMatches,
        recipientMatches,
        referenceIsUnique: !isDuplicate,
        noTampering,
      },
      isDuplicate,
      checkedAt: new Date().toISOString(),
    };

    // 9. Persist results
    const { error: updateError } = await admin
      .from("payments")
      .update({
        ai_status,
        ai_report,
      })
      .eq("id", paymentId);

    if (updateError) {
      throw new Error(`Failed to update database report: ${updateError.message}`);
    }

    return { ai_status, ai_report };

  } catch (error: any) {
    console.error(`[AI Payment Verifier] Error checking payment ${paymentId}:`, error);

    const failReport = {
      error: error.message || "Unknown error during vision analysis",
      checkedAt: new Date().toISOString(),
    };

    await admin
      .from("payments")
      .update({
        ai_status: "failed",
        ai_report: failReport,
      })
      .eq("id", paymentId);

    return {
      ai_status: "failed",
      ai_report: failReport,
    };
  }
}
