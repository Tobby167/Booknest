import { AuthCard } from "@/components/auth/AuthCard";

export default function SignupPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <AuthCard mode="signup" />
    </main>
  );
}
