"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { BookNestLoader } from "@/components/BookNestLoader";
import { requestBrowserNotificationPermission, showBrowserNotification } from "@/services/notifications/browserNotificationHelper";

type NotificationRow = {
  id: string;
  title: string | null;
  message: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
};

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/notifications");
    const data = await response.json();
    setNotifications(data.notifications ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
    await load();
  }

  async function enableBrowserNotifications() {
    const permission = await requestBrowserNotificationPermission();
    if (permission === "granted") {
      showBrowserNotification("BookNest notifications enabled", "Browser notifications can now appear while this page is open.");
    }
    setMessage(`Browser notification permission: ${permission}`);
  }

  if (loading) return <BookNestLoader label="Loading notifications" />;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink">Notifications</h1>
          <p className="mt-2 text-sm text-ink/65">In-app booking, receipt, confirmation, and reminder notices.</p>
        </div>
        <button className="btn btn-secondary" onClick={enableBrowserNotifications}>
          <BellRing className="h-4 w-4" /> Browser notifications
        </button>
      </div>
      <div className="mt-5 grid gap-3">
        {notifications.map((notification) => (
          <article className={`rounded-lg border p-4 ${notification.is_read ? "border-ink/10 bg-white" : "border-fern bg-mist"}`} key={notification.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-ink">{notification.title || "Notification"}</h2>
                <p className="mt-1 text-sm leading-6 text-ink/65">{notification.message}</p>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-ink/45">{notification.type}</p>
              </div>
              {!notification.is_read ? (
                <button className="btn btn-secondary" onClick={() => markRead(notification.id)}>
                  Mark read
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {notifications.length === 0 ? <p className="card mt-5 p-5 text-center font-bold text-ink/60">No notifications yet.</p> : null}
      {message ? <p className="mt-4 rounded-lg bg-blush/70 p-3 text-sm font-bold text-ink">{message}</p> : null}
    </div>
  );
}
