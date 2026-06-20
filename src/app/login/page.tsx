import { AuthCard } from "@/components/auth/AuthCard";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <AuthCard mode="login" />
    </main>
  );
}
