import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { fmtDate, isHours, money, tenure } from "../types";
import type { Novelty, Role } from "../types";

interface Summary { total: number; byDepartment: { name: string; count: number }[] }
interface Alerts {
  contracts: { id: number; fullName: string; endDate: string; daysLeft: number }[];
  anniversaries: { id: number; fullName: string; date: string; years: number; daysLeft: number }[];
}
interface PreviewTotals { employees: number; netPay: number; totalCost: number; negativeNet: number; pendingNovelties: number }

const QUICK: Record<Role, { to?: string; icon: string; title: string; desc: string }[]> = {
  gerente: [
    { to: "/empleados", icon: "👥", title: "Empleados", desc: "Crear, editar y gestionar personal" },
    { to: "/nomina", icon: "🧮", title: "Nómina del mes", desc: "Costo estimado y comprobantes" },
    { to: "/areas-cargos", icon: "🏢", title: "Áreas y cargos", desc: "Organiza la estructura" },
    { to: "/organigrama", icon: "🧭", title: "Organigrama", desc: "Quién depende de quién" },
    { icon: "✅", title: "Aprobaciones", desc: "Revisar y aprobar la nómina" },
  ],
  contador: [
    { to: "/nomina", icon: "🧮", title: "Vista previa de nómina", desc: "Calcula el mes con las novedades" },
    { to: "/novedades-cnt", icon: "⏱️", title: "Novedades", desc: "Horas extra y bonificaciones del mes" },
    { to: "/parametros", icon: "⚙️", title: "Parámetros", desc: "Porcentajes, recargos y SMMLV" },
    { to: "/calendario-cnt", icon: "📅", title: "Obligaciones", desc: "Fechas de pago y aportes" },
    { to: "/empleados", icon: "👥", title: "Empleados", desc: "Consulta del personal" },
  ],
  jefe_directo: [
    { to: "/novedades-jefe", icon: "⏱️", title: "Registrar novedades", desc: "Horas extra y bonificaciones" },
    { to: "/calendario-equipo", icon: "📅", title: "Calendario del equipo", desc: "Horas extra por día" },
    { to: "/equipo", icon: "👥", title: "Mi equipo", desc: "Personas a tu cargo" },
  ],
  empleado: [
    { to: "/perfil", icon: "🙍", title: "Mi perfil", desc: "Tus datos y contraseña" },
    { icon: "🧾", title: "Mis comprobantes", desc: "Pagos y boletines" },
  ],
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export default function Home() {
  const { user } = useAuth();
  if (!user) return null;
  const first = (user.employee?.fullName ?? user.email).split(" ")[0];
  const today = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <h1>{greeting()}, {first} 👋</h1>
      <p className="muted cap">{today}</p>

      {user.role === "gerente" && <ManagerWidgets />}
      {user.role === "contador" && <AccountantWidgets />}
      {user.role === "jefe_directo" && <BossWidgets />}
      {user.role === "empleado" && <EmployeeWidgets />}

      <h2 className="section">Accesos rápidos</h2>
      <div className="quick-grid">
        {QUICK[user.role].map((q) => {
          const body = (
            <>
              <span className="quick-icon">{q.icon}</span>
              <strong>{q.title}</strong>
              <span className="muted small">{q.desc}</span>
              {!q.to && <span className="tag soon">Próximamente</span>}
            </>
          );
          return q.to ? <Link key={q.title} to={q.to} className="quick">{body}</Link> : <div key={q.title} className="quick disabled">{body}</div>;
        })}
      </div>
    </>
  );
}

function usePreview() {
  const [totals, setTotals] = useState<PreviewTotals | null>(null);
  useEffect(() => {
    api<{ totals: PreviewTotals }>("/payroll/preview").then((r) => setTotals(r.totals)).catch(() => undefined);
  }, []);
  return totals;
}

function ManagerWidgets() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const totals = usePreview();

  useEffect(() => {
    api<Summary>("/employees/summary").then(setSummary).catch(() => undefined);
    api<Alerts>("/employees/alerts").then(setAlerts).catch(() => undefined);
  }, []);

  const max = Math.max(1, ...(summary?.byDepartment.map((d) => d.count) ?? [1]));

  return (
    <>
      <div className="stats">
        <div className="stat card"><span className="muted small">Empleados activos</span><strong>{summary?.total ?? "—"}</strong></div>
        <div className="stat card"><span className="muted small">Costo estimado de nómina del mes</span><strong className="md">{totals ? money(totals.totalCost) : "—"}</strong></div>
        <div className="stat card"><span className="muted small">Novedades pendientes</span><strong>{totals?.pendingNovelties ?? "—"}</strong></div>
        <div className="stat card"><span className="muted small">Contratos por vencer</span><strong>{alerts?.contracts.length ?? "—"}</strong></div>
      </div>

      <div className="two-col">
        <section className="card">
          <h2>Empleados por área</h2>
          {summary?.byDepartment.map((d) => (
            <div key={d.name} className="bar-row">
              <span>{d.name}</span>
              <div className="bar"><div style={{ width: `${(d.count / max) * 100}%` }} /></div>
              <strong>{d.count}</strong>
            </div>
          ))}
        </section>

        <section className="card">
          <h2>Alertas</h2>
          {alerts && alerts.contracts.length === 0 && alerts.anniversaries.length === 0 && <p className="muted">Sin alertas por ahora 🎉</p>}
          {alerts?.contracts.map((c) => (
            <div key={`c${c.id}`} className="alert-row">
              <span>📄 Contrato de <strong>{c.fullName}</strong> {c.daysLeft < 0 ? "venció" : "vence"} el {fmtDate(c.endDate)}</span>
              <span className={`tag ${c.daysLeft <= 15 ? "danger" : "warn"}`}>{c.daysLeft < 0 ? `hace ${-c.daysLeft} d` : c.daysLeft === 0 ? "hoy" : `en ${c.daysLeft} d`}</span>
            </div>
          ))}
          {alerts?.anniversaries.map((a) => (
            <div key={`a${a.id}`} className="alert-row">
              <span>🎂 <strong>{a.fullName}</strong> cumple {a.years} {a.years === 1 ? "año" : "años"} en la empresa el {fmtDate(a.date)}</span>
              <span className="tag ok">{a.daysLeft === 0 ? "hoy" : `en ${a.daysLeft} d`}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function AccountantWidgets() {
  const totals = usePreview();
  const [next, setNext] = useState<{ title: string; date: string } | null>(null);
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    api<{ title: string; date: string; done: boolean }[]>(`/obligations?year=${new Date().getFullYear()}`)
      .then((l) => setNext(l.find((o) => !o.done && o.date >= today) ?? null))
      .catch(() => undefined);
  }, []);
  return (
    <div className="stats">
      <div className="stat card"><span className="muted small">Novedades pendientes del mes</span><strong>{totals?.pendingNovelties ?? "—"}</strong></div>
      <div className="stat card"><span className="muted small">Neto estimado del mes</span><strong className="md">{totals ? money(totals.netPay) : "—"}</strong></div>
      <div className="stat card">
        <span className="muted small">Netos negativos</span>
        <strong>{totals?.negativeNet ?? "—"}</strong>
        {totals && totals.negativeNet > 0 && <span className="tag danger">Revisar antes de enviar</span>}
      </div>
      <div className="stat card"><span className="muted small">Próxima obligación</span><strong className="sm">{next?.title ?? "—"}</strong><span className="muted small">{next ? fmtDate(next.date) : ""}</span></div>
    </div>
  );
}

function BossWidgets() {
  const [items, setItems] = useState<Novelty[]>([]);
  useEffect(() => {
    api<{ items: Novelty[] }>("/novelties").then((r) => setItems(r.items)).catch(() => undefined);
  }, []);
  const hours = items.filter((n) => isHours(n.type)).reduce((s, n) => s + n.quantity, 0);
  return (
    <div className="stats">
      <div className="stat card"><span className="muted small">Novedades pendientes del mes</span><strong>{items.filter((n) => n.status === "pendiente").length}</strong></div>
      <div className="stat card"><span className="muted small">Horas extra del equipo este mes</span><strong>{hours}</strong></div>
    </div>
  );
}

function EmployeeWidgets() {
  const { user } = useAuth();
  const e = user?.employee;
  if (!e) return null;
  return (
    <div className="stats">
      <div className="stat card"><span className="muted small">Cargo</span><strong className="sm">{e.position}</strong><span className="muted small">{e.department}</span></div>
      <div className="stat card"><span className="muted small">Antigüedad</span><strong className="sm">{tenure(e.hireDate)}</strong><span className="muted small">desde {fmtDate(e.hireDate)}</span></div>
      <div className="stat card"><span className="muted small">Jefe directo</span><strong className="sm">{e.directManager ?? "—"}</strong></div>
      <div className="stat card"><span className="muted small">Último pago neto</span><strong>—</strong><span className="tag soon">Próximamente</span></div>
    </div>
  );
}
