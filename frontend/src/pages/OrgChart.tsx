import { useEffect, useState } from "react";
import { api } from "../api";
import type { Employee } from "../types";
import Avatar from "../components/Avatar";

export default function OrgChart() {
  const [list, setList] = useState<Employee[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Employee[]>("/employees").then(setList).catch((e) => setError((e as Error).message));
  }, []);

  const ids = new Set(list.map((e) => e.id));
  const byManager = new Map<number | null, Employee[]>();
  for (const e of list) {
    const key = e.directManagerId && ids.has(e.directManagerId) ? e.directManagerId : null;
    byManager.set(key, [...(byManager.get(key) ?? []), e]);
  }

  function Tree({ parent }: { parent: number | null }) {
    const kids = byManager.get(parent) ?? [];
    if (kids.length === 0) return null;
    return (
      <ul>
        {kids.map((k) => (
          <li key={k.id}>
            <div className="node">
              <Avatar name={k.fullName} size={40} />
              <strong>{k.fullName}</strong>
              <span className="muted small">{k.position}</span>
            </div>
            <Tree parent={k.id} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <h1>Organigrama</h1>
      {error && <p className="error">{error}</p>}
      <section className="card tree">
        <Tree parent={null} />
      </section>
    </>
  );
}
