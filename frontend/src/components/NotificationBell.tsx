import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Notif } from "../types";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [data, setData] = useState<{ items: Notif[]; unread: number }>({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    api<{ items: Notif[]; unread: number }>("/notifications").then(setData).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function openItem(n: Notif) {
    setOpen(false);
    if (!n.isRead) await api(`/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => undefined);
    load();
    if (n.link) navigate(n.link);
  }

  async function readAll() {
    await api("/notifications/read-all", { method: "PATCH" }).catch(() => undefined);
    load();
  }

  return (
    <div className="bell">
      <button className="secondary bell-btn" onClick={() => { setOpen(!open); if (!open) load(); }} aria-label="Notificaciones">
        🔔{data.unread > 0 && <span className="bell-count">{data.unread > 99 ? "99+" : data.unread}</span>}
      </button>
      {open && (
        <div className="bell-panel card">
          <div className="row">
            <strong>Notificaciones</strong>
            <span className="spacer" />
            {data.unread > 0 && <button className="link" onClick={readAll}>Marcar todas</button>}
          </div>
          {data.items.length === 0 && <p className="muted small">No tienes notificaciones.</p>}
          {data.items.slice(0, 8).map((n) => (
            <button key={n.id} className={`notif ${n.isRead ? "" : "unread"}`} onClick={() => openItem(n)}>
              <span>{n.message}</span>
              <span className="muted small">{n.createdAt.slice(0, 16).replace("T", " ")}</span>
            </button>
          ))}
          <button className="link" onClick={() => { setOpen(false); navigate("/notificaciones"); }}>Ver todas</button>
        </div>
      )}
    </div>
  );
}
