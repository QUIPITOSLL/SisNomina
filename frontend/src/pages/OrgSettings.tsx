import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";

interface Dept { id: number; name: string; employeeCount: number }
interface Pos { id: number; name: string; department: string; departmentId: number; arlRiskLevel: string; employeeCount: number }
const ARL = ["I", "II", "III", "IV", "V"];

export default function OrgSettings() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [error, setError] = useState("");
  const [deptName, setDeptName] = useState("");
  const [pos, setPos] = useState({ name: "", departmentId: "", arlRiskLevel: "I" });

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([api<Dept[]>("/org/departments"), api<Pos[]>("/org/positions")]);
      setDepts(d);
      setPositions(p);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const addDept = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => { await api("/org/departments", { method: "POST", body: { name: deptName } }); setDeptName(""); });
  };
  const addPos = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api("/org/positions", { method: "POST", body: { name: pos.name, departmentId: Number(pos.departmentId), arlRiskLevel: pos.arlRiskLevel } });
      setPos({ ...pos, name: "" });
    });
  };
  const rename = (path: string, current: string) => {
    const name = window.prompt("Nuevo nombre:", current);
    if (name && name.trim() !== current) void run(() => api(path, { method: "PATCH", body: { name } }));
  };
  const deactivate = (path: string, label: string) => {
    if (window.confirm(`¿Desactivar "${label}"?`)) void run(() => api(`${path}/deactivate`, { method: "PATCH" }));
  };

  return (
    <>
      <h1>Áreas y cargos</h1>
      {error && <p className="error">{error}</p>}

      <div className="two-col">
        <section className="card">
          <h2>Áreas</h2>
          <form className="row" onSubmit={addDept}>
            <input placeholder="Nueva área…" value={deptName} onChange={(e) => setDeptName(e.target.value)} required />
            <button type="submit">Agregar</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>Empleados</th><th /></tr></thead>
              <tbody>
                {depts.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>{d.employeeCount}</td>
                    <td className="actions">
                      <button className="secondary small-btn" onClick={() => rename(`/org/departments/${d.id}`, d.name)}>Renombrar</button>
                      <button className="danger" onClick={() => deactivate(`/org/departments/${d.id}`, d.name)}>Desactivar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2>Cargos</h2>
          <form className="stack" onSubmit={addPos}>
            <div className="grid">
              <input placeholder="Nuevo cargo…" value={pos.name} onChange={(e) => setPos({ ...pos, name: e.target.value })} required />
              <select value={pos.departmentId} onChange={(e) => setPos({ ...pos, departmentId: e.target.value })} required>
                <option value="">Área…</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select value={pos.arlRiskLevel} onChange={(e) => setPos({ ...pos, arlRiskLevel: e.target.value })} title="Nivel de riesgo ARL">
                {ARL.map((a) => <option key={a} value={a}>ARL riesgo {a}</option>)}
              </select>
            </div>
            <button type="submit">Agregar cargo</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cargo</th><th>Área</th><th>ARL</th><th>Emp.</th><th /></tr></thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.department}</td>
                    <td>
                      <select value={p.arlRiskLevel} onChange={(e) => void run(() => api(`/org/positions/${p.id}`, { method: "PATCH", body: { arlRiskLevel: e.target.value } }))}>
                        {ARL.map((a) => <option key={a}>{a}</option>)}
                      </select>
                    </td>
                    <td>{p.employeeCount}</td>
                    <td className="actions">
                      <button className="secondary small-btn" onClick={() => rename(`/org/positions/${p.id}`, p.name)}>Renombrar</button>
                      <button className="danger" onClick={() => deactivate(`/org/positions/${p.id}`, p.name)}>Desactivar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
