import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { audit } from "../audit";
import { notifyRole } from "../notify";
import { requireRole } from "../auth/middleware";
import { extraHourValue } from "../payroll/engine";
import { loadParams } from "../payroll/params";

const router = Router();

const TYPES = ["hora_extra_diurna", "hora_extra_nocturna", "hora_extra_dominical", "bonificacion", "descuento"] as const;
const LABEL: Record<string, string> = {
  hora_extra_diurna: "Hora extra diurna", hora_extra_nocturna: "Hora extra nocturna", hora_extra_dominical: "Hora extra dominical/festiva",
  bonificacion: "Bonificación", descuento: "Descuento",
};
const isHours = (t: string) => t.startsWith("hora_extra");
const monthRule = z.string().regex(/^\d{4}-\d{2}$/, "Mes inválido");
const dateRule = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

const bodySchema = z.object({
  employeeId: z.number().int(),
  type: z.enum(TYPES),
  quantity: z.number().positive("La cantidad debe ser mayor que cero"),
  isSalary: z.boolean().optional(),
  occurrenceDate: dateRule,
  justification: z.string().trim().min(5, "La justificación es muy corta").max(300),
});

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function checkQuantity(type: string, q: number): string | null {
  if (isHours(type)) return q < 0.01 || q > 24 ? "Las horas extra deben estar entre 0,01 y 24 por registro" : null;
  if (!Number.isInteger(q)) return "El valor debe ser un monto entero en pesos";
  return q > 1_000_000_000 ? "El valor es demasiado alto" : null;
}

function checkDate(date: string, hireDate: string): string | null {
  if (date > localToday()) return "La fecha no puede ser futura";
  if (date < hireDate) return "La fecha es anterior al ingreso del empleado";
  return null;
}

function parseId(req: Request, res: Response): number | null {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: "Identificador inválido" });
    return null;
  }
  return id;
}

interface Row {
  id: number; employeeId: number; employeeName: string; type: string; quantity: number; isSalary: number;
  occurrenceDate: string; justification: string; status: string; createdAt: string; createdBy: string; salaryBase: number;
}

router.get("/", requireRole("jefe_directo", "contador"), (req, res) => {
  const month = monthRule.optional().parse(req.query.month) ?? localToday().slice(0, 7);
  const sql: string[] = [
    `SELECT n.id, n.employee_id AS employeeId, e.full_name AS employeeName, n.type, n.quantity, n.is_salary AS isSalary,
            n.occurrence_date AS occurrenceDate, n.justification, n.status, n.created_at AS createdAt,
            COALESCE(c.full_name, u.email) AS createdBy, e.salary_base AS salaryBase
     FROM novelties n
     JOIN employees e ON e.id = n.employee_id
     JOIN users u ON u.id = n.created_by LEFT JOIN employees c ON c.user_id = u.id
     WHERE n.occurrence_date BETWEEN ? AND ?`,
  ];
  const args: unknown[] = [`${month}-01`, `${month}-31`];
  if (req.user!.role === "jefe_directo") {
    sql.push("AND e.direct_manager_id = ?");
    args.push(req.user!.employeeId);
  }
  sql.push("ORDER BY n.occurrence_date DESC, n.id DESC");

  const params = loadParams();
  const rows = db.prepare(sql.join(" ")).all(...args) as Row[];
  const isAccountant = req.user!.role === "contador";
  const items = rows.map(({ salaryBase, ...r }) => ({
    ...r,
    isSalary: !!r.isSalary,
    // El valor estimado solo lo ve el contador: revelaría el salario al jefe.
    ...(isAccountant && isHours(r.type)
      ? { estimatedValue: extraHourValue(salaryBase, r.type as (typeof TYPES)[0], r.quantity, params) }
      : isAccountant ? { estimatedValue: r.type === "descuento" ? -r.quantity : r.quantity } : {}),
  }));
  res.json({ items, config: { maxExtraHoursMonth: params.TOPE_HORAS_EXTRA_MES ?? 48 } });
});

function loadTeamMember(req: Request, employeeId: number) {
  return db
    .prepare("SELECT id, full_name AS fullName, hire_date AS hireDate FROM employees WHERE id = ? AND is_active = 1 AND direct_manager_id = ?")
    .get(employeeId, req.user!.employeeId) as { id: number; fullName: string; hireDate: string } | undefined;
}

router.post("/", requireRole("jefe_directo"), (req, res) => {
  const d = bodySchema.parse(req.body);
  const emp = loadTeamMember(req, d.employeeId);
  if (!emp) {
    res.status(403).json({ message: "Solo puedes registrar novedades para personas de tu equipo" });
    return;
  }
  const err = checkQuantity(d.type, d.quantity) ?? checkDate(d.occurrenceDate, emp.hireDate);
  if (err) {
    res.status(400).json({ message: err });
    return;
  }
  const isSalary = d.type === "bonificacion" && !!d.isSalary ? 1 : 0;
  const r = db
    .prepare("INSERT INTO novelties (employee_id, type, quantity, is_salary, occurrence_date, justification, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(d.employeeId, d.type, d.quantity, isSalary, d.occurrenceDate, d.justification, req.user!.id);
  const id = Number(r.lastInsertRowid);
  const amount = isHours(d.type) ? `${d.quantity} h` : `$${d.quantity.toLocaleString("es-CO")}`;
  audit({ userId: req.user!.id, eventType: "NOVEDAD_CREADA", entityType: "Novelty", entityId: id, description: `${LABEL[d.type]} (${amount}) – ${emp.fullName}`, next: d });
  notifyRole("contador", "novedad", `Nueva novedad: ${emp.fullName} – ${LABEL[d.type]} (${amount})`, "/novedades-cnt");
  res.status(201).json({ id });
});

router.patch("/:id", requireRole("jefe_directo"), (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const d = bodySchema.omit({ employeeId: true }).parse(req.body);
  const cur = db
    .prepare(
      `SELECT n.id, n.status, e.hire_date AS hireDate, e.full_name AS fullName FROM novelties n JOIN employees e ON e.id = n.employee_id
       WHERE n.id = ? AND e.direct_manager_id = ?`
    )
    .get(id, req.user!.employeeId) as { status: string; hireDate: string; fullName: string } | undefined;
  if (!cur) {
    res.status(404).json({ message: "Novedad no encontrada" });
    return;
  }
  if (cur.status !== "pendiente") {
    res.status(422).json({ message: "Solo se pueden editar novedades pendientes" });
    return;
  }
  const err = checkQuantity(d.type, d.quantity) ?? checkDate(d.occurrenceDate, cur.hireDate);
  if (err) {
    res.status(400).json({ message: err });
    return;
  }
  db.prepare("UPDATE novelties SET type = ?, quantity = ?, is_salary = ?, occurrence_date = ?, justification = ?, updated_at = datetime('now') WHERE id = ?").run(
    d.type, d.quantity, d.type === "bonificacion" && d.isSalary ? 1 : 0, d.occurrenceDate, d.justification, id
  );
  audit({ userId: req.user!.id, eventType: "NOVEDAD_EDITADA", entityType: "Novelty", entityId: id, description: `${LABEL[d.type]} – ${cur.fullName}`, next: d });
  res.json({ ok: true });
});

router.delete("/:id", requireRole("jefe_directo"), (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const cur = db
    .prepare("SELECT n.status, n.type, e.full_name AS fullName FROM novelties n JOIN employees e ON e.id = n.employee_id WHERE n.id = ? AND e.direct_manager_id = ?")
    .get(id, req.user!.employeeId) as { status: string; type: string; fullName: string } | undefined;
  if (!cur) {
    res.status(404).json({ message: "Novedad no encontrada" });
    return;
  }
  if (cur.status !== "pendiente") {
    res.status(422).json({ message: "Solo se pueden eliminar novedades pendientes" });
    return;
  }
  db.prepare("DELETE FROM novelties WHERE id = ?").run(id);
  audit({ userId: req.user!.id, eventType: "NOVEDAD_ELIMINADA", entityType: "Novelty", entityId: id, description: `${LABEL[cur.type]} – ${cur.fullName}` });
  res.json({ ok: true });
});

export default router;
