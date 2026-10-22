import { useEffect, useState } from "react";
import { api } from "../api";
import { currentMonth, isHours } from "../types";
import type { Employee, Novelty } from "../types";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function TeamCalendar() {
  const [month, setMonth] = useState(currentMonth());
  const [items, setItems] = useState<Novelty[]>([]);
  const [max, setMax] = useState(48);
  const [team, setTeam] = useState<Employee[]>([]);

  useEffect(() => {
    api<Employee[]>("/employees/my-team").then(setTeam).catch(() => undefined);
  }, []);
  useEffect(() => {
    api<{ items: Novelty[]; config: { maxExtraHoursMonth: number } }>(`/novelties?month=${month}`)
      .then((r) => { setItems(r.items.filter((n) => isHours(n.type))); setMax(r.config.maxExtraHoursMonth); })
      .catch(() => undefined);
  }, [month]);

  const [y, m] = month.split("-").map(Number);
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const byDay = (d: number) => items.filter((n) => Number(n.occurrenceDate.slice(8, 10)) === d);
  const hoursOf = (id: number) => items.filter((n) => n.employeeId === id).reduce((s, n) => s + n.quantity, 0);

  return (
    <>
      <div className="row">
        <h1>Calendario del equipo</h1>
        <span className="spacer" />
        <label className="inline">Mes <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
      </div>

      <div className="two-col">
        <section className="card">
          <h2>Horas extra por día</h2>
          <div className="cal">
            {DAYS.map((d) => <div key={d} className="cal-head">{d}</div>)}
            {cells.map((d, i) => (
              <div key={i} className={`cal-cell ${d === null ? "empty" : ""}`}>
                {d !== null && (
                  <>
                    <span className="cal-day">{d}</span>
                    {byDay(d).map((n) => (
                      <span key={n.id} className={`chip ${n.status === "aplicada" ? "ok" : ""}`} title={`${n.employeeName}: ${n.quantity} h`}>
                        {n.employeeName.split(" ")[0]} {n.quantity}h
                      </span>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Resumen del mes</h2>
          <p className="muted small">Alerta cuando una persona supera {max} h de horas extra al mes (ajustable por el contador).</p>
          {team.map((t) => {
            const h = hoursOf(t.id);
            const over = h > max;
            return (
              <div key={t.id} className="sum-row">
                <div className="row">
                  <strong>{t.fullName}</strong>
                  <span className="spacer" />
                  <span className={`tag ${over ? "danger" : h > max * 0.8 ? "warn" : "ok"}`}>{h} h{over ? " · supera el tope" : ""}</span>
                </div>
                <div className="bar"><div className={over ? "over" : ""} style={{ width: `${Math.min(100, (h / max) * 100)}%` }} /></div>
              </div>
            );
          })}
          {team.length === 0 && <p className="muted">No tienes personas a cargo.</p>}
        </section>
      </div>
    </>
  );
}
