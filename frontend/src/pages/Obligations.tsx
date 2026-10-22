import { useEffect, useState } from "react";
import { api } from "../api";
import { fmtDate, todayIso } from "../types";

interface Obl { key: string; date: string; title: string; note: string; done: boolean }
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function Obligations() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [items, setItems] = useState<Obl[]>([]);
  const [error, setError] = useState("");

  const load = () => api<Obl[]>(`/obligations?year=${year}`).then(setItems).catch((e) => setError((e as Error).message));
  useEffect(() => { void load(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(o: Obl) {
    await api(`/obligations/${o.key}/toggle`, { method: "POST" }).catch((e) => setError((e as Error).message));
    await load();
  }

  const today = todayIso();
  const soon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const upcoming = items.filter((o) => !o.done && o.date >= today).slice(0, 3);
  const status = (o: Obl) => (o.done ? { cls: "ok", text: "Hecho" } : o.date < today ? { cls: "danger", text: "Vencida" } : o.date <= soon ? { cls: "warn", text: "Esta semana" } : null);

  return (
    <>
      <div className="row">
        <h1>Calendario de obligaciones</h1>
        <span className="spacer" />
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[thisYear - 1, thisYear, thisYear + 1].map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>
      <p className="banner">Son recordatorios generales. Las fechas exactas (sobre todo la de aportes PILA) dependen de tu empresa: <strong>verifícalas con tu contador</strong>.</p>
      {error && <p className="error">{error}</p>}

      {upcoming.length > 0 && (
        <section className="card" style={{ marginBottom: "1rem" }}>
          <h2>Próximas</h2>
          {upcoming.map((o) => <div key={o.key} className="alert-row"><span>📌 {o.title}</span><span className="muted small">{fmtDate(o.date)}</span></div>)}
        </section>
      )}

      {MONTHS.map((name, i) => {
        const monthItems = items.filter((o) => Number(o.date.slice(5, 7)) === i + 1 && Number(o.date.slice(0, 4)) === year);
        if (monthItems.length === 0) return null;
        return (
          <section key={name} className="card" style={{ marginBottom: "1rem" }}>
            <h2>{name} {year}</h2>
            {monthItems.map((o) => {
              const s = status(o);
              return (
                <div key={o.key} className="alert-row">
                  <label className="check">
                    <input type="checkbox" checked={o.done} onChange={() => toggle(o)} />
                    <span><strong>{o.title}</strong><br /><span className="muted small">{fmtDate(o.date)} · {o.note}</span></span>
                  </label>
                  {s && <span className={`tag ${s.cls}`}>{s.text}</span>}
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
