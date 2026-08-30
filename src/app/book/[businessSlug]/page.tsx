import type { Metadata } from "next";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { BookingAgentWidget } from "@/components/booking/BookingAgentWidget";
import { getSiteUrl } from "@/lib/env";
import { durationLabel, priceLabel } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Business, Service, ServiceCategory } from "@/lib/types";

type PageProps = { params: Promise<{ businessSlug: string }> };

type PublicBusinessData = {
  business: Pick<Business, "id" | "name" | "slug" | "description" | "phone" | "email" | "address" | "logo_url" | "currency" | "cancellation_policy" | "timezone">;
  categories: Pick<ServiceCategory, "id" | "name" | "description" | "display_order">[];
  services: Pick<Service, "id" | "category_id" | "name" | "description" | "base_price" | "price_type" | "duration_minutes" | "display_order">[];
};

async function getPublicBusinessData(businessSlug: string): Promise<PublicBusinessData | null> {
  const supabase = await createSupabaseServerClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id,name,slug,description,phone,email,address,logo_url,currency,cancellation_policy,timezone")
    .eq("slug", businessSlug)
    .maybeSingle();

  if (!business) return null;

  const [activeCategories, activeServices] = await Promise.all([
    supabase
      .from("service_categories")
      .select("id,name,description,display_order")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("services")
      .select("id,category_id,name,description,base_price,price_type,duration_minutes,display_order")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
  ]);

  return {
    business: business as PublicBusinessData["business"],
    categories: (activeCategories.data ?? []) as PublicBusinessData["categories"],
    services: (activeServices.data ?? []) as PublicBusinessData["services"]
  };
}

function servicePrice(service: PublicBusinessData["services"][number], currencyCode = "USD") {
  return priceLabel(service.price_type, service.base_price, currencyCode);
}

function groupedServiceSections(data: PublicBusinessData) {
  const uncategorized = {
    id: "uncategorized",
    name: "Featured Services",
    description: "Popular appointment options ready to book.",
    display_order: 9999
  };
  const categories = data.categories.length ? data.categories : [uncategorized];
  const usedCategoryIds = new Set(categories.map((category) => category.id));
  const groups = categories
    .map((category) => ({
      ...category,
      services: data.services
        .filter((service) => service.category_id === category.id || (!service.category_id && category.id === uncategorized.id))
        .slice()
        .sort((left, right) => left.display_order - right.display_order || left.name.localeCompare(right.name))
    }))
    .filter((group) => group.services.length);

  const strayServices = data.services.filter((service) => service.category_id && !usedCategoryIds.has(service.category_id));
  if (strayServices.length) {
    groups.push({
      ...uncategorized,
      services: strayServices.sort((left, right) => left.display_order - right.display_order || left.name.localeCompare(right.name))
    });
  }

  return groups.slice(0, 4);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { businessSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("name,description,logo_url,slug")
    .eq("slug", businessSlug)
    .maybeSingle();

  const businessName = business?.name ?? "BookNest";
  const title = `Book an Appointment | ${businessName}`;
  const description =
    business?.description ||
    `Choose a service, select a date and time, and book your appointment with ${businessName}.`;
  const url = `${getSiteUrl()}/book/${business?.slug ?? businessSlug}`;
  const images = business?.logo_url ? [{ url: business.logo_url, alt: businessName }] : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "BookNest",
      images,
      type: "website"
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: business?.logo_url ? [business.logo_url] : undefined
    }
  };
}

export default async function PublicBookingPage({ params }: PageProps) {
  const { businessSlug } = await params;
  const data = await getPublicBusinessData(businessSlug);
  const business = data?.business;
  const groups = data ? groupedServiceSections(data) : [];
  const services = data?.services ?? [];
  const currencyCode = business?.currency || "USD";
  const featuredServices = services
    .slice()
    .sort((left, right) => left.display_order - right.display_order || left.name.localeCompare(right.name))
    .slice(0, 6);

  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#fbfaf8] text-ink">
      <section className="sticky top-0 z-40 border-b border-slate-400 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <a className="flex min-w-0 items-center gap-3" href="#top" aria-label={business ? `${business.name} home` : "Business home"}>
            {business?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={`${business.name} logo`} className="h-16 w-16 rounded-xl border border-slate-300 bg-white object-contain p-1.5 shadow-sm sm:h-20 sm:w-20" src={business.logo_url} />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-purple-600 text-lg font-black text-white">{business?.name?.slice(0, 1) ?? "B"}</span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-lg font-black sm:text-xl">{business?.name ?? "BookNest"}</span>
              <span className="block truncate text-xs font-black uppercase tracking-[0.14em] text-slate-700">Booking powered by BookNest</span>
            </span>
          </a>
          <a className="rounded-full bg-purple-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-purple-600/20" href="#booking">
            Book now
          </a>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]" id="top">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-purple-600">Appointments made simple</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-ink sm:text-5xl lg:text-6xl">
            Book your next appointment with {business?.name ?? "this business"}.
          </h1>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-800 sm:text-lg">
            {business?.description || "Choose a service, pick an available time, add your details, and confirm your booking online."}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="rounded-xl bg-purple-600 px-6 py-4 text-sm font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-purple-600/20" href="#booking">
              Start booking
            </a>
            <a className="rounded-xl border border-slate-500 bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.14em] text-slate-950 hover:border-slate-950 hover:bg-purple-50" href="#services">
              View services
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-soft">
          <div className="grid place-items-center rounded-xl border border-slate-400 bg-[#fbfaf8] p-6">
            {business?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={`${business.name} logo`} className="h-48 w-full max-w-xs object-contain sm:h-64" src={business.logo_url} />
            ) : (
              <div className="grid h-44 w-44 place-items-center rounded-2xl bg-purple-600 text-6xl font-black text-white">{business?.name?.slice(0, 1) ?? "B"}</div>
            )}
          </div>
          <div className="mt-5 grid gap-3 text-sm font-bold text-slate-800">
            {business?.phone ? <p>Phone: {business.phone}</p> : null}
            {business?.email ? <p>Email: {business.email}</p> : null}
            {business?.address ? <p>Location: {business.address}</p> : null}
            {business?.timezone ? <p>Booking time zone: {business.timezone}</p> : null}
          </div>
        </div>
      </section>

      {featuredServices.length ? (
        <section className="border-y border-slate-300/70 bg-white py-12" id="services">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-purple-600">Services</p>
                <h2 className="mt-2 text-3xl font-black text-ink sm:text-4xl">Choose what fits your appointment.</h2>
              </div>
              <a className="rounded-xl border border-slate-500 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-950 hover:border-slate-950 hover:bg-purple-50" href="#booking">
                Book a service
              </a>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featuredServices.map((service) => (
                <article className="rounded-xl border border-slate-400 bg-white p-5 shadow-sm" key={service.id}>
                  <p className="text-lg font-black text-ink">{service.name}</p>
                  {service.description ? <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-700">{service.description}</p> : null}
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                    {servicePrice(service, currencyCode)} | {durationLabel(service.duration_minutes)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {groups.length ? (
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-purple-600">Service groups</p>
          <h2 className="mt-2 text-3xl font-black text-ink sm:text-4xl">A clear path to the right booking.</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {groups.map((group) => (
              <section className="rounded-2xl border border-slate-400 bg-white p-5 shadow-sm" key={group.id}>
                <h3 className="text-xl font-black text-ink">{group.name}</h3>
                {group.description ? <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{group.description}</p> : null}
                <div className="mt-5 grid gap-3">
                  {group.services.slice(0, 4).map((service) => (
                    <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-400 bg-[#fbfaf8] p-4" key={service.id}>
                      <div>
                        <p className="font-black text-ink">{service.name}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700">{durationLabel(service.duration_minutes)}</p>
                      </div>
                      <p className="shrink-0 text-sm font-black text-purple-600">{servicePrice(service, currencyCode)}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-y border-slate-300/70 bg-white py-12">
        <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 sm:px-6 lg:grid-cols-3">
          {[
            ["1", "Pick a service", "Choose the service, option, and add-ons that match the appointment you want."],
            ["2", "Choose a time", "Select an available date and time from the live BookNest calendar."],
            ["3", "Confirm details", "Add your contact details and complete payment or receipt upload when needed."]
          ].map(([step, title, body]) => (
            <div className="rounded-xl border border-slate-300 bg-[#fbfaf8] p-5" key={step}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-purple-600 text-sm font-black text-white">{step}</span>
              <h3 className="mt-4 text-xl font-black text-ink">{title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-12 sm:px-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-purple-600">Contact</p>
          <h2 className="mt-2 text-2xl font-black text-ink">Need help before booking?</h2>
          <div className="mt-5 grid gap-3 text-sm font-bold text-slate-800">
            {business?.phone ? <p>Phone: {business.phone}</p> : null}
            {business?.email ? <p>Email: {business.email}</p> : null}
            {business?.address ? <p>Address: {business.address}</p> : null}
            {!business?.phone && !business?.email && !business?.address ? <p>Contact details will appear here when the business adds them.</p> : null}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-purple-600">Policy</p>
          <h2 className="mt-2 text-2xl font-black text-ink">Booking notes</h2>
          <p className="mt-5 text-sm font-semibold leading-7 text-slate-800">
            {business?.cancellation_policy || "Appointments may require owner confirmation. If payment is needed, follow the instructions shown during booking."}
          </p>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6" id="booking">
        <div className="mx-auto w-full max-w-6xl min-w-0">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-purple-600">Book online</p>
            <h2 className="mt-2 text-3xl font-black text-ink sm:text-4xl">Reserve your appointment.</h2>
          </div>
          <BookingFlow businessSlug={businessSlug} />
        </div>
      </section>

      <BookingAgentWidget businessSlug={businessSlug} businessName={business?.name ?? "BookNest"} currency={currencyCode} />
    </main>
  );
}
