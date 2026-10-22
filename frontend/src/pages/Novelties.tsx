import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { NOVELTY_LABEL, currentMonth, fmtDate, isHours, money, norm, todayIso } from "../types";
import type { Employee, Novelty, NoveltyType } from "../types";
import Modal from "../components/Modal";
import NoveltyForm from "../components/NoveltyForm";

export default function Novelties() {
  const { user } = useAuth();
  const isBoss = user?.role === "jefe_directo";
  const [month, setMonth] = useState(currentMonth());
  const [items, setItems] = useState<Novelty[]>([]);
  const [team, setTeam] = useState<{ id: number; fullName: string }[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Novelty | null>(null);
  const [repeat, setRepeat] = useState<Novelty | undefined>();

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Novelty[] }>(`/novelties?month=${month}`);
      setItems(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [month]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (isBoss) api<Employee[]>("/employees/my-team").then((t) => setTeam(t.map((x) => ({ id: x.id, fullName: x.fullName })))).catch(() => undefined);
  }, [isBoss]);

  const filtered = useMemo(
    () => items.filter((n) => (!status || n.status === status) && (!type || n.type === type) && (!q || norm(`${n.employeeName} ${n.justification}`).includes(norm(q)))),
    [items, q, status, type]
  );
  const pending = items.filter((n) => n.status === "pendiente").length;

  async function remove(n: Novelty) {
    if (!window.confirm(`¿Eliminar la novedad de ${n.employeeName}?`)) return;
    setError("");
    try {
      await api(`/novelties/${n.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const qty = (n: Novelty) => (isHours(n.type) ? `${n.quantity} h` : money(n.quantity));

  return (
    <>
      <div className="row">
        <h1>Novedades</h1>
        <span className="spacer" />
        <label className="inline">Mes <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
      </div>

      {isBoss && (
        <section className="card">
          <h2>Registrar novedad</h2>
          <NoveltyForm team={team} initial={repeat} onSaved={() => { setRepeat(undefined); void load(); }} />
        </section>
      )}

      <section className="card" style={{ marginTop: "1rem" }}>
        <div className="filters four">
          <input placeholder="🔍 Buscar por empleado o justificación…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todos los tipos</option>
            {(Object.keys(NOVELTY_LABEL) as NoveltyType[]).map((t) => <option key={t} value={t}>{NOVELTY_LABEL[t]}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aplicada">Aplicada</option>
          </select>
          <span className="muted small center-v">{pending} pendiente(s) este mes</span>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Empleado</th><th>Tipo</th><th>Cantidad</th>{!isBoss && <th>Valor estimado</th>}<th>Justificación</th><th>Estado</th>{isBoss && <th />}</tr>
            </thead>
            <tbody>
              {filtered.map((n) => (
                <tr key={n.id}>
                  <td>{fmtDate(n.occurrenceDate)}</td>
                  <td>{n.employeeName}<br /><span className="muted small">por {n.createdBy}</span></td>
                  <td>{NOVELTY_LABEL[n.type]}{n.isSalary && <><br /><span className="muted small">constituye salario</span></>}</td>
                  <td>{qty(n)}</td>
                  {!isBoss && <td>{n.estimatedValue !== undefined ? money(n.estimatedValue) : "—"}</td>}
                  <td>{n.justification}</td>
                  <td><span className={`tag ${n.status === "pendiente" ? "warn" : "ok"}`}>{n.status === "pendiente" ? "Pendiente" : "Aplicada"}</span></td>
                  {isBoss && (
                    <td className="actions">
                      <button className="secondary small-btn" onClick={() => { setRepeat({ ...n, occurrenceDate: todayIso() }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Repetir</button>
                      {n.status === "pendiente" && <button className="secondary small-btn" onClick={() => setEditing(n)}>Editar</button>}
                      {n.status === "pendiente" && <button className="danger" onClick={() => remove(n)}>Eliminar</button>}
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="muted">No hay novedades para este filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <Modal title="Editar novedad" onClose={() => setEditing(null)}>
          <NoveltyForm team={team} initial={editing} editingId={editing.id} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />
        </Modal>
      )}
    </>
  );
}
