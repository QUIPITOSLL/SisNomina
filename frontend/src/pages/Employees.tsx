import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ROLE_LABEL, fmtDate, money, norm } from "../types";
import type { Employee, Role } from "../types";
import Avatar from "../components/Avatar";
import Modal from "../components/Modal";
import EmployeeForm from "../components/EmployeeForm";

export default function Employees() {
  const { user } = useAuth();
  const canEdit = user?.role === "gerente";
  const [list, setList] = useState<Employee[]>([]);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Employee | "new" | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await api<Employee[]>("/employees"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const departments = useMemo(() => Array.from(new Set(list.map((e) => e.department))).sort(), [list]);
  const filtered = list.filter(
    (e) =>
      (!dept || e.department === dept) &&
      (!role || e.role === role) &&
      (!q || norm(`${e.fullName} ${e.email} ${e.documentNumber} ${e.position}`).includes(norm(q)))
  );

  async function resetPassword(emp: Employee) {
    if (!window.confirm(`¿Restablecer la contraseña de ${emp.fullName}? Se generará una temporal y deberá cambiarla al ingresar.`)) return;
    setError(""); setNotice("");
    try {
      const r = await api<{ temporaryPassword: string }>(`/employees/${emp.id}/reset-password`, { method: "POST" });
      setNotice(`Contraseña temporal de ${emp.fullName}: ${r.temporaryPassword} (se muestra una sola vez).`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deactivate(emp: Employee) {
    if (!window.confirm(`¿Desactivar a ${emp.fullName}? Ya no podrá iniciar sesión.`)) return;
    setError(""); setNotice("");
    try {
      await api(`/employees/${emp.id}/deactivate`, { method: "PATCH" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="row">
        <h1>Empleados</h1>
        <span className="spacer" />
        {canEdit && <button onClick={() => { setEditing("new"); setNotice(""); }}>＋ Nuevo empleado</button>}
      </div>

      <section className="card">
        <div className="filters">
          <input placeholder="🔍 Buscar por nombre, correo, documento o cargo…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Todas las áreas</option>
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Todos los roles</option>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>

        {notice && <p className="notice">{notice}</p>}
        {error && <p className="error">{error}</p>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Empleado</th><th>Rol</th><th>Cargo / Área</th><th>Contrato</th><th>Jefe directo</th><th>Salario base</th>{canEdit && <th />}</tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="person"><Avatar name={e.fullName} /><div>{e.fullName}<br /><span className="muted small">{e.email} · {e.documentNumber}</span></div></div>
                  </td>
                  <td><span className="badge">{ROLE_LABEL[e.role]}</span></td>
                  <td>{e.position}<br /><span className="muted small">{e.department}</span></td>
                  <td>
                    {e.contractType === "indefinido" ? "Indefinido" : <>Fijo<br /><span className="muted small">hasta {e.contractEndDate ? fmtDate(e.contractEndDate) : "—"}</span></>}
                  </td>
                  <td>{e.directManager ?? "—"}</td>
                  <td>{e.salaryBase !== undefined ? money(e.salaryBase) : "—"}</td>
                  {canEdit && (
                    <td className="actions">
                      <button className="secondary small-btn" onClick={() => { setEditing(e); setNotice(""); }}>Editar</button>
                      <button className="secondary small-btn" onClick={() => resetPassword(e)}>Contraseña</button>
                      <button className="danger" onClick={() => deactivate(e)}>Desactivar</button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="muted">No hay empleados que coincidan.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted small">{filtered.length} de {list.length} empleados</p>
      </section>

      {editing && (
        <Modal title={editing === "new" ? "Nuevo empleado" : `Editar: ${editing.fullName}`} onClose={() => setEditing(null)}>
          <EmployeeForm
            initial={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={(created) => {
              setEditing(null);
              if (created) setNotice(`${created.name} fue creado. Contraseña temporal: ${created.temporaryPassword} (se muestra una sola vez; deberá cambiarla al ingresar).`);
              void load();
            }}
          />
        </Modal>
      )}
    </>
  );
}
