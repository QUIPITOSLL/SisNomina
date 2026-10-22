import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { config } from "../config";
import { db } from "../db";
import { requireRole, ROLES } from "../auth/middleware";

const router = Router();

const BASE_SELECT = `
  SELECT e.id, e.full_name AS fullName, e.document_number AS documentNumber,
         e.contract_type AS contractType, e.contract_end_date AS contractEndDate, e.hire_date AS hireDate,
         e.phone, u.email, u.role,
         p.name AS position, e.position_id AS positionId,
         d.name AS department, e.department_id AS departmentId,
         m.full_name AS directManager, e.direct_manager_id AS directManagerId`;
const BASE_FROM = `
  FROM employees e
  JOIN users u ON u.id = e.user_id
  JOIN positions p ON p.id = e.position_id
  JOIN departments d ON d.id = e.department_id
  LEFT JOIN employees m ON m.id = e.direct_manager_id`;

const dateRule = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

function tempPassword(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (s: string) => s[crypto.randomInt(s.length)];
  let p = "";
  for (let i = 0; i < 8; i++) p += pick(letters + digits);
  return p + pick(letters) + pick(digits);
}

function parseId(req: Request, res: Response): number | null {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: "Identificador inválido" });
    return null;
  }
  return id;
}

// ---------- Listados ----------
router.get("/", requireRole("gerente", "contador"), (_req, res) => {
  res.json(db.prepare(`${BASE_SELECT}, e.salary_base AS salaryBase ${BASE_FROM} WHERE e.is_active = 1 ORDER BY e.full_name`).all());
});

router.get("/my-team", requireRole("jefe_directo"), (req, res) => {
  res.json(db.prepare(`${BASE_SELECT} ${BASE_FROM} WHERE e.is_active = 1 AND e.direct_manager_id = ? ORDER BY e.full_name`).all(req.user!.employeeId));
});

router.get("/catalog", requireRole("gerente"), (_req, res) => {
  res.json({
    departments: db.prepare("SELECT id, name FROM departments WHERE is_active = 1 ORDER BY name").all(),
    positions: db.prepare("SELECT id, name, department_id AS departmentId FROM positions WHERE is_active = 1 ORDER BY name").all(),
    managers: db
      .prepare(
        `SELECT e.id, e.full_name AS fullName FROM employees e JOIN users u ON u.id = e.user_id
         WHERE e.is_active = 1 AND u.role IN ('gerente','jefe_directo') ORDER BY e.full_name`
      )
      .all(),
  });
});

// ---------- Resumen y alertas del gerente ----------
router.get("/summary", requireRole("gerente"), (_req, res) => {
  const total = (db.prepare("SELECT COUNT(*) AS n FROM employees WHERE is_active = 1").get() as { n: number }).n;
  const byDepartment = db
    .prepare(
      `SELECT d.name, COUNT(e.id) AS count FROM departments d
       LEFT JOIN employees e ON e.department_id = d.id AND e.is_active = 1
       WHERE d.is_active = 1 GROUP BY d.id ORDER BY count DESC, d.name`
    )
    .all();
  res.json({ total, byDepartment });
});

router.get("/alerts", requireRole("gerente"), (_req, res) => {
  // Contratos a término fijo que vencen en 60 días o ya vencidos.
  const contracts = db
    .prepare(
      `SELECT id, full_name AS fullName, contract_end_date AS endDate,
              CAST(julianday(contract_end_date) - julianday(date('now')) AS INTEGER) AS daysLeft
       FROM employees
       WHERE is_active = 1 AND contract_type = 'fijo' AND contract_end_date IS NOT NULL
         AND julianday(contract_end_date) - julianday(date('now')) <= 60
       ORDER BY contract_end_date`
    )
    .all();

  // Aniversarios de ingreso en los próximos 30 días.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hires = db.prepare("SELECT id, full_name AS fullName, hire_date AS hireDate FROM employees WHERE is_active = 1").all() as {
    id: number; fullName: string; hireDate: string;
  }[];
  const anniversaries = hires
    .map((h) => {
      const [y, m, d] = h.hireDate.split("-").map(Number);
      let next = new Date(today.getFullYear(), m - 1, d);
      if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
      const daysLeft = Math.round((next.getTime() - today.getTime()) / 86_400_000);
      const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      return { id: h.id, fullName: h.fullName, date: iso, years: next.getFullYear() - y, daysLeft };
    })
    .filter((a) => a.years >= 1 && a.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  res.json({ contracts, anniversaries });
});

// ---------- Crear ----------
const createSchema = z
  .object({
    fullName: z.string().trim().min(3).max(120),
    email: z.string().trim().toLowerCase().email(),
    documentNumber: z.string().trim().min(5).max(20),
    contractType: z.enum(["indefinido", "fijo"]),
    contractEndDate: dateRule.nullable().optional(),
    hireDate: dateRule,
    salaryBase: z.number().int().positive(),
    role: z.enum(ROLES),
    positionId: z.number().int(),
    departmentId: z.number().int(),
    directManagerId: z.number().int().nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
  })
  .refine((d) => d.contractType !== "fijo" || !!d.contractEndDate, {
    message: "Los contratos a término fijo requieren fecha de finalización",
    path: ["contractEndDate"],
  });

function validateManager(managerId: number, selfId: number | null): string | null {
  const manager = db
    .prepare(
      `SELECT e.id FROM employees e JOIN users u ON u.id = e.user_id
       WHERE e.id = ? AND e.is_active = 1 AND u.role IN ('gerente','jefe_directo')`
    )
    .get(managerId);
  if (!manager) return "El jefe directo seleccionado no es válido";
  if (selfId !== null) {
    // Evita ciclos: nadie puede quedar por encima de sí mismo en la jerarquía.
    let cursor: number | null = managerId;
    for (let i = 0; cursor && i < 50; i++) {
      if (cursor === selfId) return "Ese jefe directo depende de esta persona (jerarquía circular)";
      const row = db.prepare("SELECT direct_manager_id AS m FROM employees WHERE id = ?").get(cursor) as { m: number | null } | undefined;
      cursor = row?.m ?? null;
    }
  }
  return null;
}

router.post("/", requireRole("gerente"), (req, res) => {
  const d = createSchema.parse(req.body);

  if (d.role !== "gerente" && !d.directManagerId) {
    res.status(400).json({ message: "El jefe directo es obligatorio para este rol" });
    return;
  }
  if (!db.prepare("SELECT id FROM positions WHERE id = ? AND department_id = ? AND is_active = 1").get(d.positionId, d.departmentId)) {
    res.status(400).json({ message: "El cargo no existe o no pertenece al área seleccionada" });
    return;
  }
  if (d.directManagerId) {
    const err = validateManager(d.directManagerId, null);
    if (err) {
      res.status(400).json({ message: err });
      return;
    }
  }

  const temporary = tempPassword();
  const hash = bcrypt.hashSync(temporary, config.bcryptCost);

  try {
    const employeeId = db.transaction(() => {
      const u = db.prepare("INSERT INTO users (email, password_hash, role, must_change_password) VALUES (?, ?, ?, 1)").run(d.email, hash, d.role);
      const e = db
        .prepare(
          `INSERT INTO employees (user_id, full_name, document_number, contract_type, contract_end_date, hire_date,
                                  salary_base, position_id, department_id, direct_manager_id, phone)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(u.lastInsertRowid, d.fullName, d.documentNumber, d.contractType, d.contractType === "fijo" ? d.contractEndDate : null,
             d.hireDate, d.salaryBase, d.positionId, d.departmentId, d.directManagerId ?? null, d.phone ?? null);
      const empId = Number(e.lastInsertRowid);
      db.prepare("INSERT INTO salary_history (employee_id, old_salary, new_salary, changed_by) VALUES (?, NULL, ?, ?)").run(empId, d.salaryBase, req.user!.id);
      return empId;
    })();
    res.status(201).json({ id: employeeId, temporaryPassword: temporary });
  } catch (err) {
    if ((err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
      res.status(409).json({ message: "Ya existe un usuario con ese correo o un empleado con ese documento" });
      return;
    }
    throw err;
  }
});

// ---------- Editar ----------
const updateSchema = z
  .object({
    fullName: z.string().trim().min(3).max(120),
    contractType: z.enum(["indefinido", "fijo"]),
    contractEndDate: dateRule.nullable(),
    salaryBase: z.number().int().positive(),
    positionId: z.number().int(),
    departmentId: z.number().int(),
    directManagerId: z.number().int().nullable(),
    phone: z.string().trim().max(30).nullable(),
  })
  .partial();

interface EmployeeRow {
  full_name: string; contract_type: "indefinido" | "fijo"; contract_end_date: string | null; salary_base: number;
  position_id: number; department_id: number; direct_manager_id: number | null; phone: string | null; role: string;
}

router.patch("/:id", requireRole("gerente"), (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const d = updateSchema.parse(req.body);

  const cur = db
    .prepare(
      `SELECT e.full_name, e.contract_type, e.contract_end_date, e.salary_base, e.position_id, e.department_id,
              e.direct_manager_id, e.phone, u.role
       FROM employees e JOIN users u ON u.id = e.user_id WHERE e.id = ? AND e.is_active = 1`
    )
    .get(id) as EmployeeRow | undefined;
  if (!cur) {
    res.status(404).json({ message: "Empleado no encontrado" });
    return;
  }

  const contractType = d.contractType ?? cur.contract_type;
  let endDate = d.contractEndDate !== undefined ? d.contractEndDate : cur.contract_end_date;
  if (contractType === "indefinido") endDate = null;
  if (contractType === "fijo" && !endDate) {
    res.status(400).json({ message: "Los contratos a término fijo requieren fecha de finalización" });
    return;
  }

  const positionId = d.positionId ?? cur.position_id;
  const departmentId = d.departmentId ?? cur.department_id;
  if (!db.prepare("SELECT id FROM positions WHERE id = ? AND department_id = ? AND is_active = 1").get(positionId, departmentId)) {
    res.status(400).json({ message: "El cargo no existe o no pertenece al área seleccionada" });
    return;
  }

  const managerId = d.directManagerId !== undefined ? d.directManagerId : cur.direct_manager_id;
  if (cur.role !== "gerente" && !managerId) {
    res.status(400).json({ message: "El jefe directo es obligatorio para este rol" });
    return;
  }
  if (managerId) {
    const err = validateManager(managerId, id);
    if (err) {
      res.status(400).json({ message: err });
      return;
    }
  }

  const salary = d.salaryBase ?? cur.salary_base;
  db.transaction(() => {
    db.prepare(
      `UPDATE employees SET full_name = ?, contract_type = ?, contract_end_date = ?, salary_base = ?,
              position_id = ?, department_id = ?, direct_manager_id = ?, phone = ? WHERE id = ?`
    ).run(d.fullName ?? cur.full_name, contractType, endDate, salary, positionId, departmentId, managerId ?? null,
          d.phone !== undefined ? d.phone : cur.phone, id);
    if (salary !== cur.salary_base) {
      db.prepare("INSERT INTO salary_history (employee_id, old_salary, new_salary, changed_by) VALUES (?, ?, ?, ?)").run(id, cur.salary_base, salary, req.user!.id);
    }
  })();
  res.json({ ok: true });
});

router.get("/:id/salary-history", requireRole("gerente"), (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  res.json(
    db
      .prepare(
        `SELECT h.id, h.old_salary AS oldSalary, h.new_salary AS newSalary, h.changed_at AS changedAt,
                COALESCE(e2.full_name, u.email) AS changedBy
         FROM salary_history h JOIN users u ON u.id = h.changed_by LEFT JOIN employees e2 ON e2.user_id = u.id
         WHERE h.employee_id = ? ORDER BY h.id DESC`
      )
      .all(id)
  );
});

// ---------- Restablecer contraseña ----------
router.post("/:id/reset-password", requireRole("gerente"), (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  if (id === req.user!.employeeId) {
    res.status(400).json({ message: "Para cambiar tu propia contraseña usa la sección Mi perfil" });
    return;
  }
  const emp = db.prepare("SELECT user_id AS userId FROM employees WHERE id = ? AND is_active = 1").get(id) as { userId: number } | undefined;
  if (!emp) {
    res.status(404).json({ message: "Empleado no encontrado" });
    return;
  }
  const temporary = tempPassword();
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1, failed_login_attempts = 0, locked_until = NULL WHERE id = ?").run(
    bcrypt.hashSync(temporary, config.bcryptCost),
    emp.userId
  );
  res.json({ temporaryPassword: temporary });
});

// ---------- Desactivar ----------
router.patch("/:id/deactivate", requireRole("gerente"), (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  if (id === req.user!.employeeId) {
    res.status(400).json({ message: "No puedes desactivar tu propia cuenta" });
    return;
  }
  const emp = db.prepare("SELECT user_id AS userId FROM employees WHERE id = ? AND is_active = 1").get(id) as { userId: number } | undefined;
  if (!emp) {
    res.status(404).json({ message: "Empleado no encontrado" });
    return;
  }
  const team = db.prepare("SELECT COUNT(*) AS n FROM employees WHERE direct_manager_id = ? AND is_active = 1").get(id) as { n: number };
  if (team.n > 0) {
    res.status(422).json({ message: `Tiene ${team.n} empleado(s) a cargo. Reasígnalos antes de desactivarlo.` });
    return;
  }
  db.transaction(() => {
    db.prepare("UPDATE employees SET is_active = 0, deactivation_date = date('now') WHERE id = ?").run(id);
    db.prepare("UPDATE users SET is_active = 0 WHERE id = ?").run(emp.userId);
  })();
  res.json({ ok: true });
});

export default router;
