import { Router } from "express";
import { db } from "../db";

const router = Router();

router.get("/", (req, res) => {
  const items = db
    .prepare("SELECT id, type, message, link, is_read AS isRead, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100")
    .all(req.user!.id) as { isRead: number }[];
  const unread = (db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0").get(req.user!.id) as { n: number }).n;
  res.json({ items: items.map((i) => ({ ...i, isRead: !!i.isRead })), unread });
});

router.patch("/read-all", (req, res) => {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(req.user!.id);
  res.json({ ok: true });
});

router.patch("/:id/read", (req, res) => {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(Number(req.params.id), req.user!.id);
  res.json({ ok: true });
});

export default router;
