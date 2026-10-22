import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

export default function ChangePassword({ forced = false }: { forced?: boolean }) {
  const { refresh } = useAuth();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone(false);
    try {
      await api("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
      setCurrent("");
      setNew("");
      setDone(true);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="card narrow" onSubmit={onSubmit}>
      <h2>{forced ? "Cambia tu contraseña" : "Cambiar contraseña"}</h2>
      {forced && <p className="muted">Estás usando una contraseña temporal. Define una nueva para continuar.</p>}
      <p className="muted small">Mínimo 8 caracteres, con letras y números.</p>
      <label>Contraseña actual
        <input type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </label>
      <label>Nueva contraseña
        <input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" required />
      </label>
      {error && <p className="error">{error}</p>}
      {done && !forced && <p className="notice">Contraseña actualizada correctamente.</p>}
      <button type="submit">Guardar contraseña</button>
    </form>
  );
}
