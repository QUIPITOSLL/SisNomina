import { db } from "./db";

export function audit(e: {
  userId: number | null; eventType: string; entityType: string; entityId: string | number;
  description: string; previous?: unknown; next?: unknown;
}): void {
  db.prepare(
    `INSERT INTO audit_log (event_type, entity_type, entity_id, user_id, description, previous_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    e.eventType, e.entityType, String(e.entityId), e.userId, e.description,
    e.previous === undefined ? null : JSON.stringify(e.previous),
    e.next === undefined ? null : JSON.stringify(e.next)
  );
}
