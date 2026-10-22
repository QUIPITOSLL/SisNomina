import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiry: process.env.JWT_EXPIRY ?? "8h",
  bcryptCost: Number(process.env.BCRYPT_COST ?? 12),
  dbPath: process.env.DB_PATH ?? "./data/nomina.db",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};

if (config.jwtSecret.length < 16) {
  throw new Error("Falta JWT_SECRET en el archivo .env (mínimo 16 caracteres).");
}
