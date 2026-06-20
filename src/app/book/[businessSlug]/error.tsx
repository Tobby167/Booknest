"use client";

import { useEffect } from "react";
import { FriendlyError } from "@/components/FriendlyError";

export default function BookingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("BookNest booking page error", { digest: error.digest });
  }, [error.digest]);

  return (
    <FriendlyError
      title="Booking page could not load"
      message="The booking page could not load the business information safely. Refresh and try again, or contact the business owner for help."
      reset={reset}
      primaryHref="/"
      primaryLabel="Go home"
      secondaryHref="/client/login"
      secondaryLabel="Client login"
    />
  );
}
