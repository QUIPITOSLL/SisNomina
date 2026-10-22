import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import { NOVELTY_LABEL, isHours, todayIso } from "../types";
import type { Novelty, NoveltyType } from "../types";

interface Props {
  team: { id: number; fullName: string }[];
  /** Datos para precargar (editar o repetir). */
  initial?: Partial<Novelty>;
  /** Si se indica, se edita esa novedad (PATCH); si no, se crea una nueva. */
  editingId?: number;
  onSaved: () => void;
  onCancel?: () => void;
}

export default function NoveltyForm({ team, initial, editingId, onSaved, onCancel }: Props) {
  const [f, setF] = useState({ employeeId: "", type: "hora_extra_diurna" as NoveltyType, quantity: "", isSalary: false, occurrenceDate: todayIso(), justification: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initial) return;
    setF({
      employeeId: initial.employeeId ? String(initial.employeeId) : "",
      type: initial.type ?? "hora_extra_diurna",
      quantity: initial.quantity !== undefined ? String(initial.quantity) : "",
      isSalary: !!initial.isSalary,
      occurrenceDate: initial.occurrenceDate ?? todayIso(),
      justification: initial.justification ?? "",
    });
  }, [initial]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const body = { type: f.type, quantity: Number(f.quantity), isSalary: f.isSalary, occurrenceDate: f.occurrenceDate, justification: f.justification };
    try {
      if (editingId) await api(`/novelties/${editingId}`, { method: "PATCH", body });
      else await api("/novelties", { method: "POST", body: { ...body, employeeId: Number(f.employeeId) } });
      setF((p) => ({ ...p, quantity: "", justification: "", isSalary: false }));
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <div className="grid">
        <label>Empleado
          <select value={f.employeeId} onChange={(e) => set("employeeId", e.target.value)} required disabled={!!editingId}>
            <option value="">Selecciona…</option>
            {team.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </select>
        </label>
        <label>Tipo
          <select value={f.type} onChange={(e) => set("type", e.target.value as NoveltyType)}>
            {(Object.keys(NOVELTY_LABEL) as NoveltyType[]).map((t) => <option key={t} value={t}>{NOVELTY_LABEL[t]}</option>)}
          </select>
        </label>
        <label>{isHours(f.type) ? "Horas" : "Valor (COP)"}
          <input type="number" min={isHours(f.type) ? 0.01 : 1} max={isHours(f.type) ? 24 : undefined} step={isHours(f.type) ? 0.25 : 1} value={f.quantity} onChange={(e) => set("quantity", e.target.value)} required />
        </label>
        <label>Fecha
          <input type="date" max={todayIso()} value={f.occurrenceDate} onChange={(e) => set("occurrenceDate", e.target.value)} required />
        </label>
      </div>
      {f.type === "bonificacion" && (
        <label className="check"><input type="checkbox" checked={f.isSalary} onChange={(e) => set("isSalary", e.target.checked)} /> Constituye salario (entra a la base de aportes y prestaciones)</label>
      )}
      <label>Justificación
        <input value={f.justification} onChange={(e) => set("justification", e.target.value)} placeholder="Ej.: Entrega urgente de proyecto" required minLength={5} maxLength={300} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit">{editingId ? "Guardar cambios" : "Registrar novedad"}</button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>}
      </div>
    </form>
  );
}
