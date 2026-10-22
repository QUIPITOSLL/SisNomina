import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { audit } from "../audit";
import { requireRole } from "../auth/middleware";

const router = Router();

interface Row { key: string; label: string; category: string; value: number; min: number; max: number; unit: string; updatedAt: string | null; updatedBy: string | null }

router.get("/", requireRole("contador", "gerente"), (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT p.key, p.label, p.category, p.value, p.min_value AS min, p.max_value AS max, p.unit,
                p.updated_at AS updatedAt, COALESCE(e.full_name, u.email) AS updatedBy
         FROM calculation_parameters p
         LEFT JOIN users u ON u.id = p.updated_by LEFT JOIN employees e ON e.user_id = u.id
         ORDER BY p.sort_order`
      )
      .all()
  );
});

router.patch("/:key", requireRole("contador"), (req, res) => {
  const { value } = z.object({ value: z.number().finite() }).parse(req.body);
  const row = db
    .prepare("SELECT key, label, value, min_value AS min, max_value AS max, unit FROM calculation_parameters WHERE key = ?")
    .get(req.params.key) as Pick<Row, "key" | "label" | "value" | "min" | "max" | "unit"> | undefined;
  if (!row) {
    res.status(404).json({ message: "Parámetro no encontrado" });
    return;
  }
  if (value < row.min || value > row.max) {
    res.status(400).json({ message: `"${row.label}" debe estar entre ${row.min} y ${row.max} (${row.unit}).` });
    return;
  }
  db.transaction(() => {
    db.prepare("UPDATE calculation_parameters SET value = ?, updated_by = ?, updated_at = datetime('now') WHERE key = ?").run(value, req.user!.id, row.key);
    audit({
      userId: req.user!.id, eventType: "PARAMETRO_MODIFICADO", entityType: "CalculationParameter", entityId: row.key,
      description: `${row.label}: ${row.value} → ${value} ${row.unit}`, previous: row.value, next: value,
    });
  })();
  res.json({ ok: true });
});

export default router;
