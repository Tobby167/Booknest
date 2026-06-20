"use client";

import { useEffect } from "react";
import { FriendlyError } from "@/components/FriendlyError";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("BookNest dashboard error", { digest: error.digest });
  }, [error.digest]);

  return (
    <FriendlyError
      title="Dashboard could not load"
      message="Your dashboard data could not be loaded safely. Refresh this page, then try again."
      reset={reset}
      primaryHref="/dashboard"
      primaryLabel="Dashboard"
      secondaryHref="/dashboard/settings"
      secondaryLabel="Settings"
    />
  );
}
