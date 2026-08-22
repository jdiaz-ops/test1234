"use client";

import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export function NotificationsList({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();

  async function markAllRead() {
    await fetch("/api/notificaciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    router.refresh();
  }

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div>
      {hasUnread && (
        <button
          onClick={markAllRead}
          className="text-xs text-brand-accent font-medium hover:underline mb-4"
        >
          Marcar todas como leídas
        </button>
      )}

      {notifications.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">No tienes notificaciones todavía.</p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border border-brand-line p-4 text-sm ${
                n.read ? "bg-brand-surface text-brand-ink-soft" : "bg-brand-accent-soft text-brand-ink"
              }`}
            >
              <p>{n.message}</p>
              <p className="text-xs text-brand-ink-soft mt-1 font-mono">
                {new Date(n.createdAt).toLocaleDateString("es-CO")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
