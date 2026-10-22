import { db } from "./db";
import type { Role } from "./auth/middleware";

export function notifyRole(role: Role, type: string, message: string, link?: string): void {
  const users = db.prepare("SELECT id FROM users WHERE role = ? AND is_active = 1").all(role) as { id: number }[];
  const ins = db.prepare("INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)");
  db.transaction(() => users.forEach((u) => ins.run(u.id, type, message, link ?? null)))();
}

export function notifyUser(userId: number, type: string, message: string, link?: string): void {
  db.prepare("INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)").run(userId, type, message, link ?? null);
}
