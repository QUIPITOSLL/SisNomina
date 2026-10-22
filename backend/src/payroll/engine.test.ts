import test from "node:test";
import assert from "node:assert/strict";
import { ARL_LEVELS, calculatePayroll, extraHourValue } from "./engine";
import type { EngineNovelty, Params } from "./engine";
import { PARAM_DEFAULTS } from "./defaults";

const params = (over: Params = {}): Params => ({ ...Object.fromEntries(PARAM_DEFAULTS.map((d) => [d.key, d.value])), ...over });
const run = (salary: number, novelties: EngineNovelty[] = [], over: Params = {}, arl: (typeof ARL_LEVELS)[number] = "I") =>
  calculatePayroll({ salaryBase: salary, arlRiskLevel: arl, novelties, params: params(over) });

test("salario sin novedades por encima de 2 SMMLV: sin auxilio, neto = salario - 8 %", () => {
  const r = run(4_000_000);
  assert.equal(r.transportAllowance, 0);
  assert.equal(r.employeeHealth, 160_000);
  assert.equal(r.employeePension, 160_000);
  assert.equal(r.netPay, 3_680_000);
});

test("auxilio de transporte: aplica hasta 2 SMMLV y no entra en la base de aportes", () => {
  const r = run(2_000_000);
  assert.equal(r.transportAllowance, 249_095);
  assert.equal(r.contributionBase, 2_000_000);
  assert.equal(r.netPay, 2_000_000 + 249_095 - 160_000);
  assert.equal(run(3_600_000).transportAllowance, 0);
});

test("horas extra: horas × valor hora × (1 + recargo)", () => {
  const expected = Math.round(8 * (2_500_000 / 182) * 1.25);
  assert.equal(extraHourValue(2_500_000, "hora_extra_diurna", 8, params()), expected);
  const r = run(2_500_000, [{ type: "hora_extra_diurna", quantity: 8 }]);
  assert.equal(r.extraHoursValue, expected);
  assert.equal(r.extraHours.daytime.hours, 8);
});

test("las horas extra entran a la base de aportes solo si el parámetro está activo", () => {
  const nov: EngineNovelty[] = [{ type: "hora_extra_nocturna", quantity: 10 }];
  const con = run(3_000_000, nov);
  const sin = run(3_000_000, nov, { INCLUDE_EXTRA_IN_IBC: 0 });
  assert.equal(con.contributionBase, 3_000_000 + con.extraHoursValue);
  assert.equal(sin.contributionBase, 3_000_000);
});

test("bonificación no salarial no cambia la base de aportes; la salarial sí", () => {
  assert.equal(run(3_000_000, [{ type: "bonificacion", quantity: 500_000, isSalary: false }]).contributionBase, 3_000_000);
  assert.equal(run(3_000_000, [{ type: "bonificacion", quantity: 500_000, isSalary: true }]).contributionBase, 3_500_000);
});

test("exoneración del art. 114-1: salud, SENA e ICBF del empleador en cero bajo 10 SMMLV", () => {
  const r = run(2_000_000);
  assert.equal(r.employerHealth, 0);
  assert.equal(r.employerSena, 0);
  assert.equal(r.employerIcbf, 0);
  assert.ok(r.employerPension > 0 && r.employerCaja > 0);
  const sin = run(2_000_000, [], { EXONERACION_ART114: 0 });
  assert.equal(sin.employerHealth, 170_000);
  assert.equal(sin.employerSena, 40_000);
});

test("un descuento grande puede dejar el neto negativo (se detecta)", () => {
  assert.ok(run(2_000_000, [{ type: "descuento", quantity: 3_000_000 }]).netPay < 0);
});

test("un ajuste negativo reduce el neto", () => {
  const base = run(4_000_000).netPay;
  assert.equal(run(4_000_000, [{ type: "ajuste", quantity: -100_000 }]).netPay, base - 100_000);
});

test("falta un parámetro: lanza error claro", () => {
  const p = params();
  delete p.CAJA_PCT;
  assert.throws(() => calculatePayroll({ salaryBase: 3_000_000, arlRiskLevel: "I", novelties: [], params: p }), /CAJA_PCT/);
});

test("propiedades con 1000 casos aleatorios: identidades del cálculo", () => {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const types = ["hora_extra_diurna", "hora_extra_nocturna", "hora_extra_dominical", "bonificacion", "descuento", "ajuste"] as const;
  for (let i = 0; i < 1000; i++) {
    const salary = Math.round(1_750_905 + rnd() * 20_000_000);
    const novelties: EngineNovelty[] = Array.from({ length: Math.floor(rnd() * 6) }, () => {
      const type = types[Math.floor(rnd() * types.length)];
      const hours = type.startsWith("hora_extra");
      return { type, quantity: hours ? Math.round(rnd() * 240) / 10 : Math.round(rnd() * 800_000) * (type === "ajuste" && rnd() < 0.5 ? -1 : 1), isSalary: rnd() < 0.5 };
    });
    const arl = ARL_LEVELS[Math.floor(rnd() * 5)];
    const over: Params = { INCLUDE_EXTRA_IN_IBC: rnd() < 0.5 ? 1 : 0, EXONERACION_ART114: rnd() < 0.5 ? 1 : 0 };
    const r = run(salary, novelties, over, arl);

    assert.equal(r.employeeDeductions, r.employeeHealth + r.employeePension);
    assert.equal(r.employerContributionsTotal, r.employerHealth + r.employerPension + r.employerArl + r.employerSena + r.employerIcbf + r.employerCaja);
    assert.equal(r.socialBenefitsTotal, r.cesantias + r.cesantiasInterest + r.prima + r.vacaciones);
    assert.equal(r.netPay, r.salaryBase + r.extraHoursValue + r.bonificationsTotal + r.adjustmentsTotal + r.transportAllowance - r.discountsTotal - r.employeeDeductions);
    assert.ok(Math.abs(r.employeeHealth - (r.contributionBase * 4) / 100) <= 0.5);
    assert.ok(Math.abs(r.employerPension - (r.contributionBase * 12) / 100) <= 0.5);
    assert.ok(Number.isInteger(r.netPay) && Number.isInteger(r.totalCost));
  }
});
