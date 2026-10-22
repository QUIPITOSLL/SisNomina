import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireRole } from "../auth/middleware";

const router = Router();
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

interface Obligation { key: string; date: string; title: string; note: string }

/** Recordatorios generales. Las fechas exactas dependen de tu empresa: verifícalas con tu contador. */
function build(year: number): Obligation[] {
  const list: Obligation[] = [];
  for (let m = 1; m <= 12; m++) {
    list.push({ key: `nomina-${year}-${pad(m)}`, date: iso(year, m, new Date(year, m, 0).getDate()), title: `Pago de nómina de ${MONTHS[m - 1]}`, note: "Pago a empleados al cierre del mes (ajusta si pagas quincenal)." });
    const ny = m === 12 ? year + 1 : year;
    const nm = m === 12 ? 1 : m + 1;
    list.push({ key: `pila-${year}-${pad(m)}`, date: iso(ny, nm, 10), title: `Aportes de seguridad social (PILA) de ${MONTHS[m - 1]}`, note: "Fecha aproximada: el plazo exacto depende de los últimos dígitos del NIT." });
  }
  list.push({ key: `prima-${year}-1`, date: iso(year, 6, 30), title: "Prima de servicios (primer semestre)", note: "Fecha límite de pago." });
  list.push({ key: `prima-${year}-2`, date: iso(year, 12, 20), title: "Prima de servicios (segundo semestre)", note: "Fecha límite de pago." });
  list.push({ key: `intereses-${year}`, date: iso(year, 1, 31), title: "Intereses sobre cesantías del año anterior", note: "Pago directo a los empleados." });
  list.push({ key: `cesantias-${year}`, date: iso(year, 2, 14), title: "Consignación de cesantías del año anterior", note: "Consignación en el fondo de cada empleado." });
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

router.get("/", requireRole("contador"), (req, res) => {
  const year = z.coerce.number().int().min(2020).max(2100).default(new Date().getFullYear()).parse(req.query.year);
  const done = new Set((db.prepare("SELECT key FROM obligation_checks").all() as { key: string }[]).map((r) => r.key));
  res.json(build(year).map((o) => ({ ...o, done: done.has(o.key) })));
});

router.post("/:key/toggle", requireRole("contador"), (req, res) => {
  const key = z.string().regex(/^[a-z]+-\d{4}(-\d{1,2})?$/).parse(req.params.key);
  const exists = db.prepare("SELECT key FROM obligation_checks WHERE key = ?").get(key);
  if (exists) db.prepare("DELETE FROM obligation_checks WHERE key = ?").run(key);
  else db.prepare("INSERT INTO obligation_checks (key, done_by) VALUES (?, ?)").run(key, req.user!.id);
  res.json({ done: !exists });
});

export default router;
