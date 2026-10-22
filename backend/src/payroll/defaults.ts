export interface ParamDef {
  key: string; label: string; category: string; value: number; min: number; max: number; unit: string;
}

/**
 * Valores iniciales (Colombia, 2026). Todos son editables desde la pantalla "Parámetros".
 * VALIDAR CON TU CONTADOR antes de usar en una nómina real.
 */
export const PARAM_DEFAULTS: ParamDef[] = [
  { key: "SMMLV", label: "Salario mínimo (SMMLV)", category: "General", value: 1750905, min: 0, max: 20000000, unit: "COP" },
  { key: "AUXILIO_TRANSPORTE", label: "Auxilio de transporte", category: "General", value: 249095, min: 0, max: 2000000, unit: "COP" },
  { key: "HORAS_MES", label: "Horas laborales al mes (divisor del valor hora)", category: "General", value: 182, min: 100, max: 260, unit: "horas" },
  { key: "TOPE_HORAS_EXTRA_MES", label: "Tope de alerta: horas extra por persona al mes", category: "General", value: 48, min: 0, max: 200, unit: "horas" },
  { key: "EMPLOYEE_HEALTH_PCT", label: "Salud (empleado)", category: "Aportes del empleado", value: 4, min: 0, max: 20, unit: "%" },
  { key: "EMPLOYEE_PENSION_PCT", label: "Pensión (empleado)", category: "Aportes del empleado", value: 4, min: 0, max: 20, unit: "%" },
  { key: "EMPLOYER_HEALTH_PCT", label: "Salud (empleador)", category: "Aportes patronales", value: 8.5, min: 0, max: 20, unit: "%" },
  { key: "EMPLOYER_PENSION_PCT", label: "Pensión (empleador)", category: "Aportes patronales", value: 12, min: 0, max: 20, unit: "%" },
  { key: "ARL_RISK_I", label: "ARL riesgo I", category: "ARL", value: 0.522, min: 0, max: 10, unit: "%" },
  { key: "ARL_RISK_II", label: "ARL riesgo II", category: "ARL", value: 1.044, min: 0, max: 10, unit: "%" },
  { key: "ARL_RISK_III", label: "ARL riesgo III", category: "ARL", value: 2.436, min: 0, max: 10, unit: "%" },
  { key: "ARL_RISK_IV", label: "ARL riesgo IV", category: "ARL", value: 4.35, min: 0, max: 10, unit: "%" },
  { key: "ARL_RISK_V", label: "ARL riesgo V", category: "ARL", value: 6.96, min: 0, max: 10, unit: "%" },
  { key: "SENA_PCT", label: "SENA", category: "Parafiscales", value: 2, min: 0, max: 10, unit: "%" },
  { key: "ICBF_PCT", label: "ICBF", category: "Parafiscales", value: 3, min: 0, max: 10, unit: "%" },
  { key: "CAJA_PCT", label: "Caja de compensación", category: "Parafiscales", value: 4, min: 0, max: 10, unit: "%" },
  { key: "EXTRA_DAYTIME_PCT", label: "Recargo hora extra diurna", category: "Horas extra", value: 25, min: 0, max: 300, unit: "%" },
  { key: "EXTRA_NIGHT_PCT", label: "Recargo hora extra nocturna", category: "Horas extra", value: 75, min: 0, max: 300, unit: "%" },
  { key: "EXTRA_HOLIDAY_PCT", label: "Recargo hora extra dominical/festiva (25 % + 90 % de recargo dominical)", category: "Horas extra", value: 115, min: 0, max: 300, unit: "%" },
  { key: "CESANTIAS_PCT", label: "Cesantías", category: "Prestaciones sociales", value: 8.33, min: 0, max: 20, unit: "%" },
  { key: "INTERESES_CESANTIAS_PCT", label: "Intereses sobre cesantías", category: "Prestaciones sociales", value: 12, min: 0, max: 30, unit: "%" },
  { key: "PRIMA_PCT", label: "Prima de servicios", category: "Prestaciones sociales", value: 8.33, min: 0, max: 20, unit: "%" },
  { key: "VACACIONES_PCT", label: "Vacaciones", category: "Prestaciones sociales", value: 4.17, min: 0, max: 20, unit: "%" },
  { key: "INCLUDE_EXTRA_IN_IBC", label: "Incluir horas extra en la base de aportes", category: "Reglas", value: 1, min: 0, max: 1, unit: "sí/no" },
  { key: "EXONERACION_ART114", label: "Aplicar exoneración de aportes (art. 114-1 E.T.)", category: "Reglas", value: 1, min: 0, max: 1, unit: "sí/no" },
  { key: "EXONERACION_TOPE_SMMLV", label: "Exoneración aplica a quien gana menos de (SMMLV)", category: "Reglas", value: 10, min: 1, max: 50, unit: "SMMLV" },
];
