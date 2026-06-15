const isProduction = process.env.NODE_ENV === "production";

const parseIntEnv = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

const parseCsvEnv = (name: string) =>
  (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const usePglite = process.env.USE_PGLITE === "1" || process.env.NODE_ENV === "test";

export const config = {
  isProduction,
  usePglite,
  databaseUrl: process.env.DATABASE_URL ?? "",
  port: parseIntEnv("PORT", 3333),
  corsOrigins: parseCsvEnv("CORS_ORIGINS"),
  maxBodyBytes: parseIntEnv("MAX_BODY_BYTES", 32 * 1024),
  rateLimitWindowMs: parseIntEnv("RATE_LIMIT_WINDOW_SECONDS", 60) * 1000,
  rateLimitMax: parseIntEnv("RATE_LIMIT_MAX", isProduction ? 120 : 1000),
  authRateLimitMax: parseIntEnv("AUTH_RATE_LIMIT_MAX", isProduction ? 10 : 100),
};

if (config.isProduction && config.corsOrigins.length === 0) {
  throw new Error("CORS_ORIGINS is required in production");
}

if (!config.usePglite && !config.databaseUrl) {
  throw new Error("DATABASE_URL is required unless USE_PGLITE=1");
}
