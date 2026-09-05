"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const clean = base64String.trim().replace(/^['"]|['"]$/g, "");
  const padding = "=".repeat((4 - (clean.length % 4)) % 4);
  const base64 = (clean + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export type PushState = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Must check for all required Web Push APIs safely
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    // Safety timeout: if serviceWorker.ready takes too long (or never resolves),
    // default to unsubscribed so the UI is not permanently hidden
    const timeout = setTimeout(() => {
      setState((prev) => (prev === "loading" ? "unsubscribed" : prev));
    }, 2500);

    navigator.serviceWorker.ready
      .then(async (reg) => {
        clearTimeout(timeout);
        try {
          const sub = await reg.pushManager.getSubscription();
          setState(sub ? "subscribed" : "unsubscribed");
        } catch {
          setState("unsubscribed");
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        setState("unsubscribed");
      });

    return () => clearTimeout(timeout);
  }, []);

  const subscribe = async () => {
    setError(null);
    setState("loading");
    try {
      if (!("Notification" in window)) {
        setState("unsupported");
        return;
      }

      // 1. Request user permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("denied");
        return;
      }

      // 2. Fetch VAPID public key
      const res = await fetch("/api/push-subscription");
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.publicKey) {
        throw new Error(data.error || "Missing VAPID public key from server.");
      }

      const { publicKey } = data;

      // 3. Ensure service worker is registered
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js");
      }
      await navigator.serviceWorker.ready;

      // 4. Clear any stale subscription
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        try {
          await existingSub.unsubscribe();
        } catch (e) {
          console.warn("[Push] Unsubscribe stale failed:", e);
        }
      }

      // 5. Subscribe with VAPID key
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as any,
      });

      // 6. Save to database
      const saveRes = await fetch("/api/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      const saveJson = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(saveJson.error || "Failed to save subscription in database.");
      }

      setState("subscribed");
    } catch (err: any) {
      console.error("[Push] subscribe error:", err);
      setError(err?.message || "Failed to enable notifications");
      setState("unsubscribed");
    }
  };

  const unsubscribe = async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push-subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("unsubscribed");
    } catch (err: any) {
      setError(err?.message || "Failed to disable notifications");
      setState("subscribed");
    }
  };

  const sendTest = async () => {
    setError(null);
    setTestSending(true);
    setTestSuccess(false);
    try {
      const res = await fetch("/api/push-subscription/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Server error (${res.status})`);
        return;
      }
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 5000);
    } catch (err: any) {
      setError(err?.message || "Network error: could not send test alert");
    } finally {
      setTestSending(false);
    }
  };

  return { state, error, subscribe, unsubscribe, sendTest, testSending, testSuccess };
}
