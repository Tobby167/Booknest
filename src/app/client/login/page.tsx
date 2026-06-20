import { AuthCard } from "@/components/auth/AuthCard";

function safeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/client/bookings";
  return value;
}

export default async function ClientLoginPage({ searchParams }: { searchParams?: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const nextPath = safeNextPath(params?.next);
  const nextQuery = nextPath === "/client/bookings" ? "" : `?next=${encodeURIComponent(nextPath)}`;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10">
      <AuthCard
        createAccountHref={`/client/signup${nextQuery}`}
        description="Login to save bookings, view appointment history, and prevent your own bookings from overlapping."
        mode="login"
        redirectTo={nextPath}
        role="client"
        title="Client login"
      />
    </main>
  );
}
