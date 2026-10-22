import bcrypt from "bcryptjs";
import { config } from "./config";
import { db } from "./db";

if ((db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n > 0) {
  console.log("La base de datos ya tiene usuarios. No se hizo nada.");
  process.exit(0);
}

const hash = (p: string) => bcrypt.hashSync(p, config.bcryptCost);

db.transaction(() => {
  const dep = db.prepare("INSERT INTO departments (name) VALUES (?)");
  const admin = Number(dep.run("Administración").lastInsertRowid);
  const ventas = Number(dep.run("Ventas").lastInsertRowid);

  const pos = db.prepare("INSERT INTO positions (name, arl_risk_level, department_id) VALUES (?, 'I', ?)");
  const pGerente = Number(pos.run("Gerente General", admin).lastInsertRowid);
  const pContador = Number(pos.run("Contador", admin).lastInsertRowid);
  const pSupervisor = Number(pos.run("Supervisor de Ventas", ventas).lastInsertRowid);
  const pAsesor = Number(pos.run("Asesor Comercial", ventas).lastInsertRowid);

  const addUser = db.prepare("INSERT INTO users (email, password_hash, role, must_change_password) VALUES (?, ?, ?, 0)");
  const addEmp = db.prepare(
    `INSERT INTO employees (user_id, full_name, document_number, contract_type, hire_date, salary_base,
                            position_id, department_id, direct_manager_id)
     VALUES (?, ?, ?, 'indefinido', '2024-01-15', ?, ?, ?, ?)`
  );

  const uG = addUser.run("gerente@empresa.com", hash("Gerente123"), "gerente").lastInsertRowid;
  const eG = Number(addEmp.run(uG, "Gerardo Gómez", "1000000001", 6000000, pGerente, admin, null).lastInsertRowid);

  const uC = addUser.run("contador@empresa.com", hash("Contador123"), "contador").lastInsertRowid;
  addEmp.run(uC, "Carolina Contreras", "1000000002", 3500000, pContador, admin, eG);

  const uJ = addUser.run("jefe@empresa.com", hash("Jefe12345"), "jefe_directo").lastInsertRowid;
  const eJ = Number(addEmp.run(uJ, "Jorge Jiménez", "1000000003", 2800000, pSupervisor, ventas, eG).lastInsertRowid);

  const uE = addUser.run("empleado@empresa.com", hash("Empleado123"), "empleado").lastInsertRowid;
  addEmp.run(uE, "Elena Escobar", "1000000004", 1800000, pAsesor, ventas, eJ);
})();

console.log("Datos de ejemplo creados (los salarios son solo de muestra):");
console.log("  gerente@empresa.com   / Gerente123");
console.log("  contador@empresa.com  / Contador123");
console.log("  jefe@empresa.com      / Jefe12345");
console.log("  empleado@empresa.com  / Empleado123");
