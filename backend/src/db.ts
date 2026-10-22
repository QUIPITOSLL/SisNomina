import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "./config";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('gerente','contador','jefe_directo','empleado')),
  must_change_password INTEGER NOT NULL DEFAULT 1,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  arl_risk_level TEXT NOT NULL DEFAULT 'I' CHECK (arl_risk_level IN ('I','II','III','IV','V')),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  full_name TEXT NOT NULL,
  document_number TEXT NOT NULL UNIQUE,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('indefinido','fijo')),
  hire_date TEXT NOT NULL,
  deactivation_date TEXT,
  salary_base INTEGER NOT NULL CHECK (salary_base > 0),
  position_id INTEGER NOT NULL REFERENCES positions(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  direct_manager_id INTEGER REFERENCES employees(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ---- Migraciones ligeras (Paso 2): agregan columnas y tablas sin borrar datos ----
function addColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}
addColumn("employees", "phone", "TEXT");
addColumn("employees", "address", "TEXT");
addColumn("employees", "contract_end_date", "TEXT");

db.exec(`
CREATE TABLE IF NOT EXISTS salary_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  old_salary INTEGER,
  new_salary INTEGER NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ---- Paso 3: parámetros, novedades, notificaciones, obligaciones y auditoría ----
import { PARAM_DEFAULTS } from "./payroll/defaults";

db.exec(`
CREATE TABLE IF NOT EXISTS calculation_parameters (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  value REAL NOT NULL,
  min_value REAL NOT NULL,
  max_value REAL NOT NULL,
  unit TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS novelties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  type TEXT NOT NULL CHECK (type IN ('hora_extra_diurna','hora_extra_nocturna','hora_extra_dominical','bonificacion','descuento','ajuste')),
  quantity REAL NOT NULL,
  is_salary INTEGER NOT NULL DEFAULT 0,
  occurrence_date TEXT NOT NULL,
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','aplicada')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_novelties_date ON novelties (occurrence_date);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read);

CREATE TABLE IF NOT EXISTS obligation_checks (
  key TEXT PRIMARY KEY,
  done_by INTEGER NOT NULL REFERENCES users(id),
  done_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  description TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

{
  const ins = db.prepare(
    `INSERT OR IGNORE INTO calculation_parameters (key, label, category, value, min_value, max_value, unit, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  db.transaction(() => PARAM_DEFAULTS.forEach((p, i) => ins.run(p.key, p.label, p.category, p.value, p.min, p.max, p.unit, i)))();
}
