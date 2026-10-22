/**
 * Motor de cálculo de nómina: función pura (sin base de datos ni efectos laterales).
 * Todos los porcentajes y reglas se leen de `params`; nada está escrito a fuego.
 * Los montos se redondean a pesos enteros.
 */
export const ARL_LEVELS = ["I", "II", "III", "IV", "V"] as const;
export type ArlLevel = (typeof ARL_LEVELS)[number];
export type NoveltyType =
  | "hora_extra_diurna" | "hora_extra_nocturna" | "hora_extra_dominical"
  | "bonificacion" | "descuento" | "ajuste";
export type Params = Record<string, number>;

export interface EngineNovelty {
  type: NoveltyType;
  /** Horas para horas extra; monto en COP para bonificación/descuento/ajuste (el ajuste puede ser negativo). */
  quantity: number;
  /** Solo bonificaciones: true si constituye salario (entra a la base de aportes y prestaciones). */
  isSalary?: boolean;
}
export interface EngineInput { salaryBase: number; arlRiskLevel: ArlLevel; novelties: EngineNovelty[]; params: Params }

export interface PayrollResult {
  salaryBase: number;
  hourlyValue: number;
  extraHours: { daytime: { hours: number; value: number }; night: { hours: number; value: number }; holiday: { hours: number; value: number } };
  extraHoursValue: number;
  bonificationsSalary: number;
  bonificationsNonSalary: number;
  bonificationsTotal: number;
  discountsTotal: number;
  adjustmentsTotal: number;
  transportAllowance: number;
  contributionBase: number;
  employeeHealth: number;
  employeePension: number;
  employeeDeductions: number;
  employerHealth: number;
  employerPension: number;
  employerArl: number;
  employerSena: number;
  employerIcbf: number;
  employerCaja: number;
  employerContributionsTotal: number;
  cesantias: number;
  cesantiasInterest: number;
  prima: number;
  vacaciones: number;
  socialBenefitsTotal: number;
  netPay: number;
  totalCost: number;
}

const EXTRA_KEY = {
  hora_extra_diurna: "EXTRA_DAYTIME_PCT",
  hora_extra_nocturna: "EXTRA_NIGHT_PCT",
  hora_extra_dominical: "EXTRA_HOLIDAY_PCT",
} as const;

function param(p: Params, key: string): number {
  const v = p[key];
  if (typeof v !== "number" || Number.isNaN(v)) throw new Error(`Falta el parámetro de nómina "${key}"`);
  return v;
}
const pct = (base: number, rate: number) => Math.round((base * rate) / 100);

/** Valor de las horas extra de un tipo: horas × valor hora × (1 + recargo). */
export function extraHourValue(salaryBase: number, type: keyof typeof EXTRA_KEY, hours: number, params: Params): number {
  return Math.round(hours * (salaryBase / param(params, "HORAS_MES")) * (1 + param(params, EXTRA_KEY[type]) / 100));
}

export function calculatePayroll(input: EngineInput): PayrollResult {
  const { salaryBase: salary, novelties, params: p } = input;
  if (!(salary > 0)) throw new Error("El salario base debe ser mayor que cero");
  const smmlv = param(p, "SMMLV");

  const extra = { daytime: { hours: 0, value: 0 }, night: { hours: 0, value: 0 }, holiday: { hours: 0, value: 0 } };
  let bonusSalary = 0, bonusNonSalary = 0, discounts = 0, adjustments = 0;

  for (const n of novelties) {
    switch (n.type) {
      case "hora_extra_diurna":
        extra.daytime.hours += n.quantity; extra.daytime.value += extraHourValue(salary, n.type, n.quantity, p); break;
      case "hora_extra_nocturna":
        extra.night.hours += n.quantity; extra.night.value += extraHourValue(salary, n.type, n.quantity, p); break;
      case "hora_extra_dominical":
        extra.holiday.hours += n.quantity; extra.holiday.value += extraHourValue(salary, n.type, n.quantity, p); break;
      case "bonificacion":
        if (n.isSalary) bonusSalary += n.quantity; else bonusNonSalary += n.quantity; break;
      case "descuento": discounts += n.quantity; break;
      case "ajuste": adjustments += n.quantity; break;
    }
  }

  const extraHoursValue = extra.daytime.value + extra.night.value + extra.holiday.value;
  const bonificationsTotal = bonusSalary + bonusNonSalary;
  const transportAllowance = salary <= 2 * smmlv ? param(p, "AUXILIO_TRANSPORTE") : 0;

  // Base de cotización: salario + (horas extra) + bonificaciones salariales; tope legal de 25 SMMLV.
  const includeExtra = param(p, "INCLUDE_EXTRA_IN_IBC") === 1;
  const ibc = Math.min(salary + (includeExtra ? extraHoursValue : 0) + bonusSalary, 25 * smmlv);

  const employeeHealth = pct(ibc, param(p, "EMPLOYEE_HEALTH_PCT"));
  const employeePension = pct(ibc, param(p, "EMPLOYEE_PENSION_PCT"));
  const employeeDeductions = employeeHealth + employeePension;

  const exonerated = param(p, "EXONERACION_ART114") === 1 && ibc < param(p, "EXONERACION_TOPE_SMMLV") * smmlv;
  const employerHealth = exonerated ? 0 : pct(ibc, param(p, "EMPLOYER_HEALTH_PCT"));
  const employerSena = exonerated ? 0 : pct(ibc, param(p, "SENA_PCT"));
  const employerIcbf = exonerated ? 0 : pct(ibc, param(p, "ICBF_PCT"));
  const employerPension = pct(ibc, param(p, "EMPLOYER_PENSION_PCT"));
  const employerArl = pct(ibc, param(p, `ARL_RISK_${input.arlRiskLevel}`));
  const employerCaja = pct(ibc, param(p, "CAJA_PCT"));
  const employerContributionsTotal = employerHealth + employerPension + employerArl + employerSena + employerIcbf + employerCaja;

  // Prestaciones: cesantías y prima incluyen el auxilio de transporte; vacaciones no.
  const salaryItems = salary + extraHoursValue + bonusSalary;
  const cesantias = pct(salaryItems + transportAllowance, param(p, "CESANTIAS_PCT"));
  const prima = pct(salaryItems + transportAllowance, param(p, "PRIMA_PCT"));
  const vacaciones = pct(salaryItems, param(p, "VACACIONES_PCT"));
  const cesantiasInterest = pct(cesantias, param(p, "INTERESES_CESANTIAS_PCT"));
  const socialBenefitsTotal = cesantias + cesantiasInterest + prima + vacaciones;

  const gross = salary + extraHoursValue + bonificationsTotal + adjustments + transportAllowance;
  return {
    salaryBase: salary,
    hourlyValue: Math.round(salary / param(p, "HORAS_MES")),
    extraHours: extra,
    extraHoursValue,
    bonificationsSalary: bonusSalary,
    bonificationsNonSalary: bonusNonSalary,
    bonificationsTotal,
    discountsTotal: discounts,
    adjustmentsTotal: adjustments,
    transportAllowance,
    contributionBase: ibc,
    employeeHealth, employeePension, employeeDeductions,
    employerHealth, employerPension, employerArl, employerSena, employerIcbf, employerCaja, employerContributionsTotal,
    cesantias, cesantiasInterest, prima, vacaciones, socialBenefitsTotal,
    netPay: gross - discounts - employeeDeductions,
    totalCost: gross + employerContributionsTotal + socialBenefitsTotal,
  };
}
