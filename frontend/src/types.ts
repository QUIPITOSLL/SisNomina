export type Role = "gerente" | "contador" | "jefe_directo" | "empleado";

export const ROLE_LABEL: Record<Role, string> = {
  gerente: "Gerente",
  contador: "Contador",
  jefe_directo: "Jefe directo",
  empleado: "Empleado",
};

export interface Me {
  id: number;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  employee: {
    id: number; fullName: string; position: string; department: string; documentNumber: string;
    contractType: "indefinido" | "fijo"; contractEndDate: string | null; hireDate: string;
    directManager: string | null; phone: string | null; address: string | null;
  } | null;
}

export interface Employee {
  id: number; fullName: string; documentNumber: string;
  contractType: "indefinido" | "fijo"; contractEndDate: string | null; hireDate: string;
  email: string; role: Role; phone: string | null;
  position: string; positionId: number; department: string; departmentId: number;
  directManager: string | null; directManagerId: number | null;
  salaryBase?: number;
}

export interface Catalog {
  departments: { id: number; name: string }[];
  positions: { id: number; name: string; departmentId: number }[];
  managers: { id: number; fullName: string }[];
}

export const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

/** Normaliza texto para buscar sin importar tildes ni mayúsculas. */
export const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

export const fmtDate = (iso: string) =>
  new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

export function tenure(hire: string): string {
  const h = new Date(hire + "T00:00:00");
  const n = new Date();
  let months = (n.getFullYear() - h.getFullYear()) * 12 + n.getMonth() - h.getMonth();
  if (n.getDate() < h.getDate()) months--;
  months = Math.max(months, 0);
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} ${y === 1 ? "año" : "años"}`);
  if (m || !y) parts.push(`${m} ${m === 1 ? "mes" : "meses"}`);
  return parts.join(" y ");
}

// ---------- Paso 3 ----------
export type NoveltyType = "hora_extra_diurna" | "hora_extra_nocturna" | "hora_extra_dominical" | "bonificacion" | "descuento";

export const NOVELTY_LABEL: Record<NoveltyType, string> = {
  hora_extra_diurna: "Hora extra diurna",
  hora_extra_nocturna: "Hora extra nocturna",
  hora_extra_dominical: "Hora extra dominical/festiva",
  bonificacion: "Bonificación",
  descuento: "Descuento",
};

export const isHours = (t: string) => t.startsWith("hora_extra");

export interface Novelty {
  id: number; employeeId: number; employeeName: string; type: NoveltyType; quantity: number; isSalary: boolean;
  occurrenceDate: string; justification: string; status: "pendiente" | "aplicada"; createdAt: string; createdBy: string;
  estimatedValue?: number;
}

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
export const todayIso = () => `${currentMonth()}-${String(new Date().getDate()).padStart(2, "0")}`;

export interface PayrollResult {
  salaryBase: number; hourlyValue: number;
  extraHours: { daytime: { hours: number; value: number }; night: { hours: number; value: number }; holiday: { hours: number; value: number } };
  extraHoursValue: number; bonificationsTotal: number; discountsTotal: number; adjustmentsTotal: number;
  transportAllowance: number; contributionBase: number;
  employeeHealth: number; employeePension: number; employeeDeductions: number;
  employerHealth: number; employerPension: number; employerArl: number; employerSena: number; employerIcbf: number; employerCaja: number;
  employerContributionsTotal: number;
  cesantias: number; cesantiasInterest: number; prima: number; vacaciones: number; socialBenefitsTotal: number;
  netPay: number; totalCost: number;
}

export interface Notif { id: number; type: string; message: string; link: string | null; isRead: boolean; createdAt: string }
