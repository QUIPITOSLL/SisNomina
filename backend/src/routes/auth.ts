import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config";
import { db } from "../db";
import { authenticate } from "../auth/middleware";

const router = Router();

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
// Mensaje único para cualquier fallo: no revela si el correo existe o si la cuenta está bloqueada.
const GENERIC_ERROR = { message: "Correo o contraseña incorrectos" };
const DUMMY_HASH = bcrypt.hashSync("dummy-password", config.bcryptCost);

const passwordRule = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72)
  .regex(/[A-Za-z]/, "La contraseña debe incluir al menos una letra")
  .regex(/\d/, "La contraseña debe incluir al menos un número");

interface LoginRow {
  id: number;
  email: string;
  password_hash: string;
  role: string;
  must_change_password: number;
  failed_login_attempts: number;
  locked_until: string | null;
  is_active: number;
}

router.post("/auth/login", (req, res) => {
  const { email, password } = z
    .object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(72) })
    .parse(req.body);

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as LoginRow | undefined;

  if (!user || !user.is_active) {
    bcrypt.compareSync(password, DUMMY_HASH); // iguala tiempos de respuesta
    res.status(401).json(GENERIC_ERROR);
    return;
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    res.status(401).json(GENERIC_ERROR);
    return;
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    const attempts = user.failed_login_attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      const until = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
      db.prepare("UPDATE users SET failed_login_attempts = 0, locked_until = ? WHERE id = ?").run(until, user.id);
    } else {
      db.prepare("UPDATE users SET failed_login_attempts = ? WHERE id = ?").run(attempts, user.id);
    }
    res.status(401).json(GENERIC_ERROR);
    return;
  }

  db.prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?").run(user.id);

  const token = jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: config.jwtExpiry as jwt.SignOptions["expiresIn"],
  });
  res.json({ token });
});

router.get("/me", authenticate, (req, res) => {
  const u = req.user!;
  const employee = u.employeeId
    ? db
        .prepare(
          `SELECT e.id, e.full_name AS fullName, p.name AS position, d.name AS department,
                  e.document_number AS documentNumber, e.contract_type AS contractType,
                  e.contract_end_date AS contractEndDate, e.hire_date AS hireDate,
                  m.full_name AS directManager, e.phone, e.address
           FROM employees e
           JOIN positions p ON p.id = e.position_id
           JOIN departments d ON d.id = e.department_id
           LEFT JOIN employees m ON m.id = e.direct_manager_id
           WHERE e.id = ?`
        )
        .get(u.employeeId)
    : null;
  res.json({ id: u.id, email: u.email, role: u.role, mustChangePassword: u.mustChangePassword, employee });
});

router.patch("/me/profile", authenticate, (req, res) => {
  const d = z
    .object({ phone: z.string().trim().max(30).nullable(), address: z.string().trim().max(200).nullable() })
    .parse(req.body);
  if (!req.user!.employeeId) {
    res.status(404).json({ message: "Tu usuario no tiene ficha de empleado" });
    return;
  }
  db.prepare("UPDATE employees SET phone = ?, address = ? WHERE id = ?").run(d.phone || null, d.address || null, req.user!.employeeId);
  res.json({ ok: true });
});

router.post("/auth/change-password", authenticate, (req, res) => {
  const { currentPassword, newPassword } = z
    .object({ currentPassword: z.string().min(1), newPassword: passwordRule })
    .parse(req.body);

  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user!.id) as { password_hash: string };
  if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
    res.status(400).json({ message: "La contraseña actual no es correcta" });
    return;
  }
  if (currentPassword === newPassword) {
    res.status(400).json({ message: "La nueva contraseña debe ser distinta a la actual" });
    return;
  }
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(
    bcrypt.hashSync(newPassword, config.bcryptCost),
    req.user!.id
  );
  res.json({ ok: true });
});

export default router;
