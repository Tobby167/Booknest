"use client";

import { useEffect } from "react";
import { FriendlyError } from "@/components/FriendlyError";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("BookNest page error", { digest: error.digest });
  }, [error.digest]);

  return (
    <FriendlyError
      title="This page could not load"
      message="BookNest hit a problem while loading this page. Refresh and try again. If it keeps happening, tell support what page you were opening."
      reset={reset}
    />
  );
}
