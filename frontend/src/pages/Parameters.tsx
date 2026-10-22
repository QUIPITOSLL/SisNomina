import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

interface Param { key: string; label: string; category: string; value: number; min: number; max: number; unit: string; updatedAt: string | null; updatedBy: string | null }

export default function Parameters() {
  const { user } = useAuth();
  const canEdit = user?.role === "contador";
  const [params, setParams] = useState<Param[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState("");

  const load = () => api<Param[]>("/parameters").then((p) => { setParams(p); setDraft({}); }).catch(() => undefined);
  useEffect(() => { void load(); }, []);

  async function save(p: Param) {
    setErrors((e) => ({ ...e, [p.key]: "" }));
    setSaved("");
    try {
      await api(`/parameters/${p.key}`, { method: "PATCH", body: { value: Number(draft[p.key]) } });
      setSaved(`"${p.label}" actualizado.`);
      await load();
    } catch (err) {
      setErrors((e) => ({ ...e, [p.key]: (err as Error).message }));
    }
  }

  const categories = Array.from(new Set(params.map((p) => p.category)));

  return (
    <>
      <h1>Parámetros de nómina</h1>
      <p className="banner">⚠️ Los valores iniciales se basan en la normativa colombiana de 2026 (decretos 1469 y 1470 de 2025 y la Ley 2466 de 2025). <strong>Valídalos con tu contador</strong> antes de usarlos en una nómina real.</p>
      {saved && <p className="notice">{saved}</p>}

      {categories.map((c) => (
        <section key={c} className="card" style={{ marginBottom: "1rem" }}>
          <h2>{c}</h2>
          {params.filter((p) => p.category === c).map((p) => {
            const value = draft[p.key] ?? String(p.value);
            const changed = draft[p.key] !== undefined && Number(draft[p.key]) !== p.value;
            return (
              <div key={p.key} className="param-row">
                <div>
                  <strong>{p.label}</strong>
                  <div className="muted small">Rango permitido: {p.min} a {p.max} {p.unit}{p.updatedAt && ` · editado por ${p.updatedBy} el ${p.updatedAt.slice(0, 10)}`}</div>
                  {errors[p.key] && <div className="error">{errors[p.key]}</div>}
                </div>
                <div className="row">
                  {p.unit === "sí/no" ? (
                    <select value={value} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, [p.key]: e.target.value })}>
                      <option value="1">Sí</option><option value="0">No</option>
                    </select>
                  ) : (
                    <input type="number" step="any" value={value} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, [p.key]: e.target.value })} />
                  )}
                  <span className="muted small unit">{p.unit === "sí/no" ? "" : p.unit}</span>
                  {canEdit && <button disabled={!changed} onClick={() => save(p)}>Guardar</button>}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}
