import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireRole } from "../auth/middleware";
import { calculatePayroll } from "../payroll/engine";
import type { ArlLevel, EngineNovelty, PayrollResult } from "../payroll/engine";
import { loadParams } from "../payroll/params";

const router = Router();

interface EmpRow {
  id: number; fullName: string; documentNumber: string; salaryBase: number; contractType: string;
  hireDate: string; position: string; arl: ArlLevel; department: string;
}
interface NovRow { employeeId: number; type: EngineNovelty["type"]; quantity: number; isSalary: number; status: string }

// Vista previa del mes: calcula con el motor, sin guardar nada. La nómina oficial (períodos) llega en el Paso 4.
router.get("/preview", requireRole("contador", "gerente"), (req, res) => {
  const now = new Date();
  const month = z.string().regex(/^\d{4}-\d{2}$/).optional().parse(req.query.month) ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  const params = loadParams();

  const employees = db
    .prepare(
      `SELECT e.id, e.full_name AS fullName, e.document_number AS documentNumber, e.salary_base AS salaryBase,
              e.contract_type AS contractType, e.hire_date AS hireDate, p.name AS position, p.arl_risk_level AS arl, d.name AS department
       FROM employees e JOIN positions p ON p.id = e.position_id JOIN departments d ON d.id = e.department_id
       WHERE e.is_active = 1 AND e.hire_date <= ? ORDER BY d.name, e.full_name`
    )
    .all(end) as EmpRow[];

  const novelties = db
    .prepare("SELECT employee_id AS employeeId, type, quantity, is_salary AS isSalary, status FROM novelties WHERE occurrence_date BETWEEN ? AND ?")
    .all(start, end) as NovRow[];

  const entries = employees.map((e) => {
    const mine = novelties.filter((n) => n.employeeId === e.id);
    const result: PayrollResult = calculatePayroll({
      salaryBase: e.salaryBase,
      arlRiskLevel: e.arl,
      novelties: mine.map((n) => ({ type: n.type, quantity: n.quantity, isSalary: !!n.isSalary })),
      params,
    });
    return { employee: e, noveltyCount: mine.length, result };
  });

  res.json({
    month,
    entries,
    totals: {
      employees: entries.length,
      netPay: entries.reduce((s, x) => s + x.result.netPay, 0),
      totalCost: entries.reduce((s, x) => s + x.result.totalCost, 0),
      negativeNet: entries.filter((x) => x.result.netPay < 0).length,
      pendingNovelties: novelties.filter((n) => n.status === "pendiente").length,
    },
  });
});

export default router;
