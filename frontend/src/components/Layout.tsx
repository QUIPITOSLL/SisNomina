import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { ROLE_LABEL } from "../types";
import type { Role } from "../types";
import Avatar from "./Avatar";
import ChangePassword from "./ChangePassword";
import NotificationBell from "./NotificationBell";

export const NAV: Record<Role, { to: string; label: string; icon: string }[]> = {
  gerente: [
    { to: "/", label: "Inicio", icon: "🏠" },
    { to: "/empleados", label: "Empleados", icon: "👥" },
    { to: "/nomina", label: "Nómina del mes", icon: "🧮" },
    { to: "/organigrama", label: "Organigrama", icon: "🧭" },
    { to: "/areas-cargos", label: "Áreas y cargos", icon: "🏢" },
    { to: "/parametros", label: "Parámetros", icon: "⚙️" },
    { to: "/notificaciones", label: "Notificaciones", icon: "🔔" },
    { to: "/perfil", label: "Mi perfil", icon: "🙍" },
  ],
  contador: [
    { to: "/", label: "Inicio", icon: "🏠" },
    { to: "/nomina", label: "Vista previa de nómina", icon: "🧮" },
    { to: "/novedades-cnt", label: "Novedades", icon: "⏱️" },
    { to: "/parametros", label: "Parámetros", icon: "⚙️" },
    { to: "/calendario-cnt", label: "Obligaciones", icon: "📅" },
    { to: "/empleados", label: "Empleados", icon: "👥" },
    { to: "/organigrama", label: "Organigrama", icon: "🧭" },
    { to: "/notificaciones", label: "Notificaciones", icon: "🔔" },
    { to: "/perfil", label: "Mi perfil", icon: "🙍" },
  ],
  jefe_directo: [
    { to: "/", label: "Inicio", icon: "🏠" },
    { to: "/equipo", label: "Mi equipo", icon: "👥" },
    { to: "/novedades-jefe", label: "Novedades", icon: "⏱️" },
    { to: "/calendario-equipo", label: "Calendario del equipo", icon: "📅" },
    { to: "/notificaciones", label: "Notificaciones", icon: "🔔" },
    { to: "/perfil", label: "Mi perfil", icon: "🙍" },
  ],
  empleado: [
    { to: "/", label: "Inicio", icon: "🏠" },
    { to: "/notificaciones", label: "Notificaciones", icon: "🔔" },
    { to: "/perfil", label: "Mi perfil", icon: "🙍" },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const name = user.employee?.fullName ?? user.email;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">💼 Nómina</div>
        <nav>
          {NAV[user.role].map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              <span>{i.icon}</span> {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user">
            <Avatar name={name} />
            <div>
              <strong>{name}</strong>
              <br />
              <span className="muted small">{ROLE_LABEL[user.role]}</span>
            </div>
          </div>
          <button className="secondary" onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="content">
        {!user.mustChangePassword && <div className="topbar-mini"><NotificationBell /></div>}
        {user.mustChangePassword ? <ChangePassword forced /> : <Outlet />}
      </main>
    </div>
  );
}
