"use client";

import { Bell, BellOff, X, Send, CheckCircle2, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useState } from "react";

export function PushNotificationBanner() {
  const { state, error, subscribe, unsubscribe, sendTest, testSending, testSuccess } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Don't render if unsupported, loading, or manually dismissed
  if (state === "unsupported" || state === "loading" || dismissed) {
    return null;
  }

  // If already subscribed, show a compact confirmation bar with a Test button
  if (state === "subscribed") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900 shadow-sm mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              Push notifications are <strong>active</strong> on this device.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => sendTest()}
              disabled={testSending}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {testSending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {testSuccess ? "Γ£ô Alert Sent!" : testSending ? "Sending..." : "Send Test Alert"}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="rounded p-1 text-emerald-500 hover:text-emerald-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-2 text-red-600 font-medium bg-red-50 px-2 py-1.5 rounded border border-red-200">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm shadow-sm mb-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
        <Bell className="h-4 w-4 text-indigo-600" />
      </div>
      <div className="flex-1">
        {state === "denied" ? (
          <>
            <p className="font-semibold text-indigo-900">Notifications are blocked</p>
            <p className="text-indigo-700 mt-0.5 text-xs">
              To receive instant booking alerts, open your browser / phone site settings and allow notifications for BookNest.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-indigo-900">Enable push notifications</p>
            <p className="text-indigo-700 mt-0.5 text-xs">
              Get instant alerts on this device whenever a new booking, payment, or cancellation comes in ΓÇö even when the browser is closed.
            </p>
            {error && <p className="mt-1.5 text-red-600 text-xs font-medium bg-red-50 p-1.5 rounded border border-red-200">{error}</p>}
            <button
              onClick={subscribe}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Bell className="h-3.5 w-3.5" />
              Enable Notifications
            </button>
          </>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 rounded p-1 text-indigo-400 hover:text-indigo-700 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Small icon button for the dashboard header ΓÇö shows current status & allows quick test */
export function PushNotificationToggle() {
  const { state, subscribe, unsubscribe, sendTest, testSending } = usePushNotifications();

  if (state === "unsupported" || state === "loading") return null;

  const isOn = state === "subscribed";

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        onClick={isOn ? unsubscribe : subscribe}
        title={isOn ? "Notifications ON ΓÇö click to disable" : "Enable push notifications"}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
          isOn
            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
      >
        {isOn ? <Bell className="h-3.5 w-3.5 text-emerald-600" /> : <BellOff className="h-3.5 w-3.5" />}
        {isOn ? "Alerts ON" : "Alerts OFF"}
      </button>

      {isOn && (
        <button
          onClick={() => sendTest()}
          disabled={testSending}
          title="Send a test notification to verify"
          className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
        >
          {testSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 text-slate-500" />}
          Test
        </button>
      )}
    </div>
  );
}
