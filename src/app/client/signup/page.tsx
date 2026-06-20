import { AuthCard } from "@/components/auth/AuthCard";

function safeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/client/bookings";
  return value;
}

export default async function ClientSignupPage({ searchParams }: { searchParams?: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const nextPath = safeNextPath(params?.next);
  const nextQuery = nextPath === "/client/bookings" ? "" : `?next=${encodeURIComponent(nextPath)}`;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10">
      <AuthCard
        description="Create a client login to track bookings and use protected discounts. If you already own a BookNest account, login with that same email."
        loginHref={`/client/login${nextQuery}`}
        mode="signup"
        redirectTo={nextPath}
        role="client"
        signupRedirectTo={nextPath}
        title="Create client account"
      />
    </main>
  );
}
