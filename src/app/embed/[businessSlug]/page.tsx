import { BookingFlow } from "@/components/booking/BookingFlow";

type PageProps = { params: Promise<{ businessSlug: string }> };

export default async function EmbedBookingPage({ params }: PageProps) {
  const { businessSlug } = await params;
  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-white">
      <BookingFlow businessSlug={businessSlug} embed />
    </main>
  );
}
