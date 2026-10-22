import { useEffect, useState } from "react";
import { api } from "../api";
import { currentMonth, money } from "../types";
import type { PayrollResult } from "../types";
import Modal from "../components/Modal";

interface Entry {
  employee: { id: number; fullName: string; documentNumber: string; position: string; department: string; contractType: string; arl: string };
  noveltyCount: number;
  result: PayrollResult;
}
interface Preview { month: string; entries: Entry[]; totals: { employees: number; netPay: number; totalCost: number; negativeNet: number; pendingNovelties: number } }

export default function PayrollPreview() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<Entry | null>(null);

  useEffect(() => {
    setError("");
    api<Preview>(`/payroll/preview?month=${month}`).then(setData).catch((e) => setError((e as Error).message));
  }, [month]);

  return (
    <>
      <div className="row">
        <h1>Vista previa de nómina</h1>
        <span className="spacer" />
        <label className="inline">Mes <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
      </div>
      <p className="banner">Es un cálculo estimado con los parámetros actuales y las novedades del mes. No guarda nada: el flujo oficial (períodos, aprobación y cierre) llega en el siguiente paso.</p>
      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <div className="stats">
            <div className="stat card"><span className="muted small">Empleados</span><strong>{data.totals.employees}</strong></div>
            <div className="stat card"><span className="muted small">Neto total a pagar</span><strong className="md">{money(data.totals.netPay)}</strong></div>
            <div className="stat card"><span className="muted small">Costo total para la empresa</span><strong className="md">{money(data.totals.totalCost)}</strong></div>
            <div className="stat card">
              <span className="muted small">Revisión</span>
              <strong className="sm">{data.totals.negativeNet > 0 ? `⚠️ ${data.totals.negativeNet} neto(s) negativo(s)` : "✅ Sin netos negativos"}</strong>
              <span className="muted small">{data.totals.pendingNovelties} novedad(es) pendiente(s)</span>
            </div>
          </div>

          <section className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Empleado</th><th>Salario base</th><th>Horas extra</th><th>Bonif.</th><th>Descuentos</th><th>Deducciones</th><th>Neto a pagar</th><th /></tr></thead>
                <tbody>
                  {data.entries.map((x) => (
                    <tr key={x.employee.id}>
                      <td>{x.employee.fullName}<br /><span className="muted small">{x.employee.position} · {x.employee.department}</span></td>
                      <td>{money(x.result.salaryBase)}</td>
                      <td>{money(x.result.extraHoursValue)}</td>
                      <td>{money(x.result.bonificationsTotal)}</td>
                      <td>{money(x.result.discountsTotal)}</td>
                      <td>{money(x.result.employeeDeductions)}</td>
                      <td><strong className={x.result.netPay < 0 ? "neg" : ""}>{money(x.result.netPay)}</strong></td>
                      <td><button className="secondary small-btn" onClick={() => setDetail(x)}>Ver comprobante</button></td>
                    </tr>
                  ))}
                  {data.entries.length === 0 && <tr><td colSpan={8} className="muted">No hay empleados activos para este mes.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {detail && (
        <Modal title={`Comprobante (vista previa): ${detail.employee.fullName}`} onClose={() => setDetail(null)}>
          <Payslip e={detail} month={month} />
        </Modal>
      )}
    </>
  );
}

function Line({ label, value, strong, negative }: { label: string; value: number; strong?: boolean; negative?: boolean }) {
  return <div className={`line ${strong ? "strong" : ""}`}><span>{label}</span><span>{negative ? "− " : ""}{money(value)}</span></div>;
}

function Payslip({ e, month }: { e: Entry; month: string }) {
  const r = e.result;
  const h = r.extraHours;
  return (
    <div className="payslip">
      <p className="muted small">{e.employee.fullName} · Doc. {e.employee.documentNumber} · {e.employee.position} · Contrato {e.employee.contractType} · Período {month}</p>
      <h3>Ingresos</h3>
      <Line label="Salario base" value={r.salaryBase} />
      {h.daytime.hours > 0 && <Line label={`Horas extra diurnas (${h.daytime.hours} h)`} value={h.daytime.value} />}
      {h.night.hours > 0 && <Line label={`Horas extra nocturnas (${h.night.hours} h)`} value={h.night.value} />}
      {h.holiday.hours > 0 && <Line label={`Horas extra dominicales/festivas (${h.holiday.hours} h)`} value={h.holiday.value} />}
      {r.bonificationsTotal > 0 && <Line label="Bonificaciones" value={r.bonificationsTotal} />}
      {r.transportAllowance > 0 && <Line label="Auxilio de transporte" value={r.transportAllowance} />}
      {r.adjustmentsTotal !== 0 && <Line label="Ajustes" value={r.adjustmentsTotal} />}
      <h3>Deducciones del empleado</h3>
      <Line label="Salud" value={r.employeeHealth} negative />
      <Line label="Pensión" value={r.employeePension} negative />
      {r.discountsTotal > 0 && <Line label="Descuentos" value={r.discountsTotal} negative />}
      <Line label="Neto a pagar" value={r.netPay} strong />
      <h3>Aportes del empleador (base {money(r.contributionBase)})</h3>
      <Line label="Salud" value={r.employerHealth} />
      <Line label="Pensión" value={r.employerPension} />
      <Line label={`ARL (riesgo ${e.employee.arl})`} value={r.employerArl} />
      <Line label="SENA" value={r.employerSena} />
      <Line label="ICBF" value={r.employerIcbf} />
      <Line label="Caja de compensación" value={r.employerCaja} />
      <h3>Prestaciones sociales (provisión mensual)</h3>
      <Line label="Cesantías" value={r.cesantias} />
      <Line label="Intereses sobre cesantías" value={r.cesantiasInterest} />
      <Line label="Prima de servicios" value={r.prima} />
      <Line label="Vacaciones" value={r.vacaciones} />
      <Line label="Costo total para la empresa" value={r.totalCost} strong />
    </div>
  );
}
