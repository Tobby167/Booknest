import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminBusinessesPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: businesses }, { data: profiles }, { data: services }, { data: availability }] = await Promise.all([
    supabase.from("businesses").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,full_name,email,role"),
    supabase.from("services").select("id,business_id"),
    supabase.from("availability").select("id,business_id,is_available").eq("is_available", true)
  ]);

  const servicesByBusiness = new Map<string, number>();
  const availabilityByBusiness = new Map<string, number>();
  (services ?? []).forEach((service) => servicesByBusiness.set(service.business_id, (servicesByBusiness.get(service.business_id) ?? 0) + 1));
  (availability ?? []).forEach((row) => availabilityByBusiness.set(row.business_id, (availabilityByBusiness.get(row.business_id) ?? 0) + 1));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-600">Super admin</p>
        <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">Businesses</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">Review all business accounts and their setup state.</p>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-5 py-3">Business</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Services</th>
                <th className="px-5 py-3">Availability</th>
                <th className="px-5 py-3">Payment details</th>
                <th className="px-5 py-3">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(businesses ?? []).map((business) => {
                const owner = (profiles ?? []).find((profile) => profile.id === business.owner_id);
                const hasPaymentDetails = Boolean(business.bank_name || business.bank_account_name || business.bank_account_number);
                return (
                  <tr className="hover:bg-slate-50/70" key={business.id}>
                    <td className="px-5 py-4">
                      <p className="font-black text-ink">{business.name}</p>
                      <p className="text-xs text-ink/45">/{business.slug}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-ink/75">{owner?.email || owner?.full_name || "Unknown"}</p>
                      <p className="text-xs text-ink/45">{owner?.role || "No profile"}</p>
                    </td>
                    <td className="px-5 py-4 font-black text-ink">{servicesByBusiness.get(business.id) ?? 0}</td>
                    <td className="px-5 py-4">{availabilityByBusiness.get(business.id) ? "Open days set" : "Missing"}</td>
                    <td className="px-5 py-4">{hasPaymentDetails ? "Manual payment ready" : "Missing"}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-3">
                        <Link className="text-xs font-black text-purple-600 hover:text-purple-800" href={`/admin/businesses/${business.id}`}>Manage</Link>
                        <Link className="text-xs font-black text-slate-600 hover:text-slate-800" href={`/book/${business.slug}`}>Booking</Link>
                        <Link className="text-xs font-black text-slate-600 hover:text-slate-800" href={`/embed/${business.slug}`}>Embed</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
