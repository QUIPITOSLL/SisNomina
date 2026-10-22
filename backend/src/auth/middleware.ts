import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { db } from "../db";

export const ROLES = ["gerente", "contador", "jefe_directo", "empleado"] as const;
export type Role = (typeof ROLES)[number];

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  employeeId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface UserRow {
  id: number;
  email: string;
  role: Role;
  mcp: number;
  is_active: number;
  employeeId: number | null;
}

/** Valida el JWT y carga el usuario desde la BD (el rol nunca se toma del cliente). */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  let user: AuthUser | null = null;

  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
      const row = db
        .prepare(
          `SELECT u.id, u.email, u.role, u.must_change_password AS mcp, u.is_active, e.id AS employeeId
           FROM users u LEFT JOIN employees e ON e.user_id = u.id WHERE u.id = ?`
        )
        .get(Number(payload.sub)) as UserRow | undefined;
      if (row && row.is_active) {
        user = { id: row.id, email: row.email, role: row.role, mustChangePassword: !!row.mcp, employeeId: row.employeeId };
      }
    } catch {
      user = null;
    }
  }

  if (!user) {
    res.status(401).json({ message: "Sesión no válida o expirada" });
    return;
  }
  req.user = user;
  next();
}

/** Bloquea el acceso a datos mientras la persona no cambie su contraseña temporal. */
export function requirePasswordChanged(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.mustChangePassword) {
    res.status(403).json({ message: "Debes cambiar tu contraseña temporal para continuar", code: "PASSWORD_CHANGE_REQUIRED" });
    return;
  }
  next();
}

export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowed.includes(req.user.role)) {
      res.status(403).json({ message: "No tienes permiso para esta operación" });
      return;
    }
    next();
  };
}
