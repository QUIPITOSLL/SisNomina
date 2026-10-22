import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { ZodError } from "zod";
import { config } from "./config";
import "./db";
import { authenticate, requirePasswordChanged } from "./auth/middleware";
import authRouter from "./routes/auth";
import employeesRouter from "./routes/employees";
import orgRouter from "./routes/org";
import parametersRouter from "./routes/parameters";
import noveltiesRouter from "./routes/novelties";
import notificationsRouter from "./routes/notifications";
import payrollRouter from "./routes/payroll";
import obligationsRouter from "./routes/obligations";

const app = express();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api", authRouter);
app.use("/api/employees", authenticate, requirePasswordChanged, employeesRouter);
app.use("/api/org", authenticate, requirePasswordChanged, orgRouter);
app.use("/api/parameters", authenticate, requirePasswordChanged, parametersRouter);
app.use("/api/novelties", authenticate, requirePasswordChanged, noveltiesRouter);
app.use("/api/notifications", authenticate, requirePasswordChanged, notificationsRouter);
app.use("/api/payroll", authenticate, requirePasswordChanged, payrollRouter);
app.use("/api/obligations", authenticate, requirePasswordChanged, obligationsRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    res.status(400).json({ message: `Dato inválido${issue?.path.length ? ` en "${issue.path.join(".")}"` : ""}: ${issue?.message ?? ""}` });
    return;
  }
  if ((err as { type?: string })?.type === "entity.parse.failed") {
    res.status(400).json({ message: "El cuerpo de la solicitud no es JSON válido" });
    return;
  }
  console.error(err);
  res.status(500).json({ message: "Error interno del servidor" });
});

app.listen(config.port, () => console.log(`API de nómina escuchando en http://localhost:${config.port}`));
