import { fail, getOwnedBusiness, ok, requireUser } from "@/lib/api";

function todayIso(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const business = await getOwnedBusiness(supabase);
  if (!business) return ok({ business: null, stats: null });

  const { data: appointments, error } = await supabase.from("appointments").select("*").eq("business_id", business.id);
  if (error) return fail(error.message, 500);
  const rows = appointments ?? [];

  const stats = {
    totalAppointments: rows.length,
    pendingAppointments: rows.filter((row) => row.status === "pending" || row.status === "pending_confirmation").length,
    confirmedAppointments: rows.filter((row) => row.status === "confirmed").length,
    completedAppointments: rows.filter((row) => row.status === "completed").length,
    revenueConfirmed: rows
      .filter((row) => row.payment_status === "confirmed")
      .reduce((total, row) => total + Number(row.total_price || 0), 0),
    todaysAppointments: rows.filter((row) => row.appointment_date === todayIso()).length,
    upcomingAppointments: rows.filter((row) => row.appointment_date >= todayIso() && !["cancelled", "completed", "no_show"].includes(row.status)).length,
    pendingReceipts: rows.filter((row) => row.payment_status === "receipt_uploaded").length,
    needsFollowUp: rows.filter((row) => row.status === "pending_confirmation" || row.payment_status === "receipt_uploaded").length
  };

  return ok({ business, stats });
}
