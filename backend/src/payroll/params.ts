import { db } from "../db";
import type { Params } from "./engine";

export function loadParams(): Params {
  const rows = db.prepare("SELECT key, value FROM calculation_parameters").all() as { key: string; value: number }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
