import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";
import { useAuth } from "./auth";
import type { Role } from "./types";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Employees from "./pages/Employees";
import OrgChart from "./pages/OrgChart";
import OrgSettings from "./pages/OrgSettings";
import Team from "./pages/Team";
import Profile from "./pages/Profile";
import Novelties from "./pages/Novelties";
import TeamCalendar from "./pages/TeamCalendar";
import Parameters from "./pages/Parameters";
import Obligations from "./pages/Obligations";
import PayrollPreview from "./pages/PayrollPreview";
import Notifications from "./pages/Notifications";

function Guard({ roles, children }: { roles: Role[]; children: ReactElement }) {
  const { user } = useAuth();
  return user && roles.includes(user.role) ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Home />} />
        <Route path="/empleados" element={<Guard roles={["gerente", "contador"]}><Employees /></Guard>} />
        <Route path="/organigrama" element={<Guard roles={["gerente", "contador"]}><OrgChart /></Guard>} />
        <Route path="/areas-cargos" element={<Guard roles={["gerente"]}><OrgSettings /></Guard>} />
        <Route path="/equipo" element={<Guard roles={["jefe_directo"]}><Team /></Guard>} />
        <Route path="/nomina" element={<Guard roles={["gerente", "contador"]}><PayrollPreview /></Guard>} />
        <Route path="/parametros" element={<Guard roles={["gerente", "contador"]}><Parameters /></Guard>} />
        <Route path="/novedades-cnt" element={<Guard roles={["contador"]}><Novelties /></Guard>} />
        <Route path="/calendario-cnt" element={<Guard roles={["contador"]}><Obligations /></Guard>} />
        <Route path="/novedades-jefe" element={<Guard roles={["jefe_directo"]}><Novelties /></Guard>} />
        <Route path="/calendario-equipo" element={<Guard roles={["jefe_directo"]}><TeamCalendar /></Guard>} />
        <Route path="/notificaciones" element={<Notifications />} />
        <Route path="/perfil" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
