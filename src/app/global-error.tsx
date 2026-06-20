"use client";

import { useEffect } from "react";
import { FriendlyError } from "@/components/FriendlyError";
import "./globals.css";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("BookNest app error", { digest: error.digest });
  }, [error.digest]);

  return (
    <html lang="en">
      <body>
        <FriendlyError
          title="BookNest needs a refresh"
          message="The app could not finish loading safely. Please refresh the page. If it keeps happening, contact support with the page you were trying to open."
          reset={reset}
        />
      </body>
    </html>
  );
}
