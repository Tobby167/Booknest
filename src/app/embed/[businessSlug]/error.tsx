"use client";

import { useEffect } from "react";
import { FriendlyError } from "@/components/FriendlyError";

export default function EmbedError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("BookNest embed error", { digest: error.digest });
  }, [error.digest]);

  return (
    <FriendlyError
      title="Booking form could not load"
      message="This embedded booking form could not load safely. Refresh the page or open the direct booking link."
      reset={reset}
      compact
      primaryHref="/"
      primaryLabel="Open BookNest"
      secondaryHref="/client/login"
      secondaryLabel="Client login"
    />
  );
}
