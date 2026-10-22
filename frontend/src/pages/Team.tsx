import { useEffect, useState } from "react";
import { api } from "../api";
import { fmtDate, norm } from "../types";
import type { Employee } from "../types";
import Avatar from "../components/Avatar";

export default function Team() {
  const [team, setTeam] = useState<Employee[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Employee[]>("/employees/my-team").then(setTeam).catch((e) => setError((e as Error).message));
  }, []);

  const filtered = team.filter((e) => !q || norm(`${e.fullName} ${e.position} ${e.email}`).includes(norm(q)));

  return (
    <>
      <h1>Mi equipo</h1>
      <section className="card">
        <div className="filters">
          <input placeholder="🔍 Buscar en mi equipo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {error && <p className="error">{error}</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Persona</th><th>Cargo</th><th>Ingreso</th><th>Teléfono</th></tr></thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td><div className="person"><Avatar name={e.fullName} /><div>{e.fullName}<br /><span className="muted small">{e.email}</span></div></div></td>
                  <td>{e.position}</td>
                  <td>{fmtDate(e.hireDate)}</td>
                  <td>{e.phone ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="muted">No hay personas que coincidan.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted small">Aquí podrás registrar novedades de tu equipo en el próximo paso.</p>
      </section>
    </>
  );
}
