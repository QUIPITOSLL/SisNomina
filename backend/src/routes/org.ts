import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireRole } from "../auth/middleware";

const router = Router();
const nameRule = z.string().trim().min(2, "El nombre es muy corto").max(80);
const arlRule = z.enum(["I", "II", "III", "IV", "V"]);

const isUnique = (err: unknown) => (err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE";
function parseId(req: Request, res: Response): number | null {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: "Identificador inválido" });
    return null;
  }
  return id;
}
const activeCount = (sql: string, id: number) => (db.prepare(sql).get(id) as { n: number }).n;

// ---------- Áreas ----------
router.get("/departments", requireRole("gerente", "contador"), (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT d.id, d.name,
                (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id AND e.is_active = 1) AS employeeCount
         FROM departments d WHERE d.is_active = 1 ORDER BY d.name`
      )
      .all()
  );
});

router.post("/departments", requireRole("gerente"), (req, res) => {
  const { name } = z.object({ name: nameRule }).parse(req.body);
  try {
    const r = db.prepare("INSERT INTO departments (name) VALUES (?)").run(name);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (err) {
    if (isUnique(err)) {
      res.status(409).json({ message: "Ya existe un área con ese nombre" });
      return;
    }
    throw err;
  }
});

router.patch("/departments/:id", requireRole("gerente"), (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const { name } = z.object({ name: nameRule }).parse(req.body);
  try {
    const r = db.prepare("UPDATE departments SET name = ? WHERE id = ? AND is_active = 1").run(name, id);
    if (r.changes === 0) {
      res.status(404).json({ message: "Área no encontrada" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    if (isUnique(err)) {
      res.status(409).json({ message: "Ya existe un área con ese nombre" });
      return;
    }
    throw err;
  }
});

router.patch("/departments/:id/deactivate", requireRole("gerente"), (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const n = activeCount("SELECT COUNT(*) AS n FROM employees WHERE department_id = ? AND is_active = 1", id);
  if (n > 0) {
    res.status(422).json({ message: `No se puede desactivar: tiene ${n} empleado(s) activo(s).` });
    return;
  }
  db.transaction(() => {
    db.prepare("UPDATE positions SET is_active = 0 WHERE department_id = ?").run(id);
    db.prepare("UPDATE departments SET is_active = 0 WHERE id = ?").run(id);
  })();
  res.json({ ok: true });
});

// ---------- Cargos ----------
router.get("/positions", requireRole("gerente", "contador"), (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT p.id, p.name, p.arl_risk_level AS arlRiskLevel, p.department_id AS departmentId, d.name AS department,
                (SELECT COUNT(*) FROM employees e WHERE e.position_id = p.id AND e.is_active = 1) AS employeeCount
         FROM positions p JOIN departments d ON d.id = p.department_id
         WHERE p.is_active = 1 ORDER BY d.name, p.name`
      )
      .all()
  );
});

router.post("/positions", requireRole("gerente"), (req, res) => {
  const d = z.object({ name: nameRule, departmentId: z.number().int(), arlRiskLevel: arlRule }).parse(req.body);
  if (!db.prepare("SELECT id FROM departments WHERE id = ? AND is_active = 1").get(d.departmentId)) {
    res.status(400).json({ message: "El área seleccionada no existe" });
    return;
  }
  const r = db.prepare("INSERT INTO positions (name, arl_risk_level, department_id) VALUES (?, ?, ?)").run(d.name, d.arlRiskLevel, d.departmentId);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

router.patch("/positions/:id", requireRole("gerente"), (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const d = z.object({ name: nameRule, arlRiskLevel: arlRule }).partial().parse(req.body);
  const cur = db.prepare("SELECT name, arl_risk_level AS arl FROM positions WHERE id = ? AND is_active = 1").get(id) as { name: string; arl: string } | undefined;
  if (!cur) {
    res.status(404).json({ message: "Cargo no encontrado" });
    return;
  }
  db.prepare("UPDATE positions SET name = ?, arl_risk_level = ? WHERE id = ?").run(d.name ?? cur.name, d.arlRiskLevel ?? cur.arl, id);
  res.json({ ok: true });
});

router.patch("/positions/:id/deactivate", requireRole("gerente"), (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const n = activeCount("SELECT COUNT(*) AS n FROM employees WHERE position_id = ? AND is_active = 1", id);
  if (n > 0) {
    res.status(422).json({ message: `No se puede desactivar: tiene ${n} empleado(s) activo(s).` });
    return;
  }
  db.prepare("UPDATE positions SET is_active = 0 WHERE id = ?").run(id);
  res.json({ ok: true });
});

export default router;
