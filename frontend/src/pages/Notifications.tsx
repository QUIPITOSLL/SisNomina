import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Notif } from "../types";

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const load = useCallback(() => api<{ items: Notif[] }>("/notifications").then((r) => setItems(r.items)).catch(() => undefined), []);
  useEffect(() => { void load(); }, [load]);

  async function open(n: Notif) {
    if (!n.isRead) await api(`/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => undefined);
    if (n.link) navigate(n.link);
    else await load();
  }

  return (
    <>
      <div className="row">
        <h1>Notificaciones</h1>
        <span className="spacer" />
        <button className="secondary" onClick={async () => { await api("/notifications/read-all", { method: "PATCH" }); await load(); }}>Marcar todas como leídas</button>
      </div>
      <section className="card">
        {items.length === 0 && <p className="muted">No tienes notificaciones.</p>}
        {items.map((n) => (
          <button key={n.id} className={`notif ${n.isRead ? "" : "unread"}`} onClick={() => open(n)}>
            <span>{n.message}</span>
            <span className="muted small">{n.createdAt.slice(0, 16).replace("T", " ")}</span>
          </button>
        ))}
      </section>
    </>
  );
}
