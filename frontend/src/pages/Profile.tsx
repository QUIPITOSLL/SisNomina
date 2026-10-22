import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ROLE_LABEL, fmtDate, tenure } from "../types";
import Avatar from "../components/Avatar";
import ChangePassword from "../components/ChangePassword";

export default function Profile() {
  const { user, refresh } = useAuth();
  const e = user?.employee ?? null;
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setPhone(e?.phone ?? "");
    setAddress(e?.address ?? "");
  }, [e?.phone, e?.address]);

  if (!user) return null;
  const name = e?.fullName ?? user.email;

  async function save(ev: FormEvent) {
    ev.preventDefault();
    setMsg(""); setError("");
    try {
      await api("/me/profile", { method: "PATCH", body: { phone: phone || null, address: address || null } });
      await refresh();
      setMsg("Datos de contacto actualizados.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <h1>Mi perfil</h1>
      <div className="two-col">
        <section className="card stack">
          <div className="person big">
            <Avatar name={name} size={64} />
            <div>
              <h2>{name}</h2>
              <span className="badge">{ROLE_LABEL[user.role]}</span>
              <p className="muted small">{user.email}</p>
            </div>
          </div>
          {e && (
            <dl className="facts">
              <dt>Documento</dt><dd>{e.documentNumber}</dd>
              <dt>Cargo</dt><dd>{e.position}</dd>
              <dt>Área</dt><dd>{e.department}</dd>
              <dt>Jefe directo</dt><dd>{e.directManager ?? "—"}</dd>
              <dt>Contrato</dt><dd>{e.contractType === "indefinido" ? "Indefinido" : `Término fijo (hasta ${e.contractEndDate ? fmtDate(e.contractEndDate) : "—"})`}</dd>
              <dt>Ingreso</dt><dd>{fmtDate(e.hireDate)} · {tenure(e.hireDate)}</dd>
            </dl>
          )}
        </section>

        <div className="stack">
          {e && (
            <form className="card stack" onSubmit={save}>
              <h2>Datos de contacto</h2>
              <label>Teléfono<input value={phone} onChange={(ev) => setPhone(ev.target.value)} /></label>
              <label>Dirección<input value={address} onChange={(ev) => setAddress(ev.target.value)} /></label>
              {error && <p className="error">{error}</p>}
              {msg && <p className="notice">{msg}</p>}
              <button type="submit">Guardar</button>
            </form>
          )}
          <ChangePassword />
        </div>
      </div>
    </>
  );
}
