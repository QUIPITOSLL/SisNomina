import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import { ROLE_LABEL, money } from "../types";
import type { Catalog, Employee, Role } from "../types";

interface History { id: number; oldSalary: number | null; newSalary: number; changedAt: string; changedBy: string }

interface Props {
  initial?: Employee;
  onSaved: (created?: { name: string; temporaryPassword: string }) => void;
  onCancel: () => void;
}

export default function EmployeeForm({ initial, onSaved, onCancel }: Props) {
  const editing = !!initial;
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [error, setError] = useState("");
  const [f, setF] = useState({
    fullName: initial?.fullName ?? "",
    email: initial?.email ?? "",
    documentNumber: initial?.documentNumber ?? "",
    hireDate: initial?.hireDate ?? "",
    salaryBase: initial?.salaryBase !== undefined ? String(initial.salaryBase) : "",
    contractType: initial?.contractType ?? "indefinido",
    contractEndDate: initial?.contractEndDate ?? "",
    role: (initial?.role ?? "empleado") as Role,
    departmentId: initial ? String(initial.departmentId) : "",
    positionId: initial ? String(initial.positionId) : "",
    directManagerId: initial?.directManagerId ? String(initial.directManagerId) : "",
    phone: initial?.phone ?? "",
  });

  useEffect(() => {
    api<Catalog>("/employees/catalog").then(setCatalog).catch((e) => setError((e as Error).message));
    if (initial) api<History[]>(`/employees/${initial.id}/salary-history`).then(setHistory).catch(() => undefined);
  }, [initial]);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const positions = catalog?.positions.filter((p) => String(p.departmentId) === f.departmentId) ?? [];
  const managers = catalog?.managers.filter((m) => m.id !== initial?.id) ?? [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const shared = {
      fullName: f.fullName,
      contractType: f.contractType,
      contractEndDate: f.contractType === "fijo" ? f.contractEndDate || null : null,
      salaryBase: Number(f.salaryBase),
      departmentId: Number(f.departmentId),
      positionId: Number(f.positionId),
      directManagerId: f.directManagerId ? Number(f.directManagerId) : null,
      phone: f.phone || null,
    };
    try {
      if (initial) {
        await api(`/employees/${initial.id}`, { method: "PATCH", body: shared });
        onSaved();
      } else {
        const res = await api<{ temporaryPassword: string }>("/employees", {
          method: "POST",
          body: { ...shared, email: f.email, documentNumber: f.documentNumber, hireDate: f.hireDate, role: f.role },
        });
        onSaved({ name: f.fullName, temporaryPassword: res.temporaryPassword });
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <div className="grid">
        <label>Nombre completo<input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} required /></label>
        <label>Correo<input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} required disabled={editing} /></label>
        <label>Documento<input value={f.documentNumber} onChange={(e) => set("documentNumber", e.target.value)} required disabled={editing} /></label>
        <label>Teléfono<input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></label>
        <label>Fecha de ingreso<input type="date" value={f.hireDate} onChange={(e) => set("hireDate", e.target.value)} required disabled={editing} /></label>
        <label>Salario base (COP)<input type="number" min={1} value={f.salaryBase} onChange={(e) => set("salaryBase", e.target.value)} required /></label>
        <label>Tipo de contrato
          <select value={f.contractType} onChange={(e) => set("contractType", e.target.value)}>
            <option value="indefinido">Indefinido</option>
            <option value="fijo">Término fijo</option>
          </select>
        </label>
        {f.contractType === "fijo" && (
          <label>Fin del contrato<input type="date" value={f.contractEndDate} onChange={(e) => set("contractEndDate", e.target.value)} required /></label>
        )}
        <label>Rol en el sistema
          <select value={f.role} onChange={(e) => set("role", e.target.value)} disabled={editing}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </label>
        <label>Área
          <select value={f.departmentId} onChange={(e) => { set("departmentId", e.target.value); set("positionId", ""); }} required>
            <option value="">Selecciona…</option>
            {catalog?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label>Cargo
          <select value={f.positionId} onChange={(e) => set("positionId", e.target.value)} required disabled={!f.departmentId}>
            <option value="">Selecciona…</option>
            {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>Jefe directo
          <select value={f.directManagerId} onChange={(e) => set("directManagerId", e.target.value)} required={f.role !== "gerente"}>
            <option value="">{f.role === "gerente" ? "Ninguno" : "Selecciona…"}</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit">{editing ? "Guardar cambios" : "Crear empleado"}</button>
        <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>
      </div>

      {editing && (
        <div className="history">
          <h3>Historial de salario</h3>
          {history.length === 0 && <p className="muted small">Sin cambios registrados.</p>}
          {history.map((h) => (
            <div key={h.id} className="alert-row">
              <span>{h.oldSalary === null ? `Salario inicial: ${money(h.newSalary)}` : `${money(h.oldSalary)} → ${money(h.newSalary)}`}</span>
              <span className="muted small">{h.changedAt.slice(0, 10)} · {h.changedBy}</span>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
