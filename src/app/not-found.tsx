import { FriendlyError } from "@/components/FriendlyError";

export default function NotFound() {
  return (
    <FriendlyError
      title="Page not found"
      message="The page you opened does not exist or the link is no longer active."
      primaryHref="/"
      primaryLabel="Go home"
      secondaryHref="/login"
      secondaryLabel="Login"
    />
  );
}
