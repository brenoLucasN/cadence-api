import { Elysia } from "elysia";
import { config } from "../config";

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const devOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

export const isAllowedOrigin = (origin: string | null) => {
  if (!origin) return true;
  if (config.corsOrigins.includes(origin)) return true;
  return !config.isProduction && devOrigin.test(origin);
};

const clientIp = (request: Request) =>
  request.headers.get("cf-connecting-ip") ??
  request.headers.get("x-real-ip") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const isAuthPath = (path: string) => path === "/auth/login" || path === "/auth/register";

const rateLimitKey = (request: Request, path: string) => {
  const email =
    request.method === "POST" && isAuthPath(path)
      ? request.headers.get("x-cadence-login")?.toLowerCase()
      : undefined;
  return `${clientIp(request)}:${path}:${email ?? ""}`;
};

export const securityPlugin = new Elysia({ name: "security" })
  .onRequest(({ request, set, status }) => {
    set.headers["x-content-type-options"] = "nosniff";
    set.headers["referrer-policy"] = "no-referrer";
    set.headers["x-frame-options"] = "DENY";

    if (mutatingMethods.has(request.method)) {
      const contentLength = request.headers.get("content-length");
      if (contentLength && Number(contentLength) > config.maxBodyBytes) {
        return status(413, { error: "Payload too large" });
      }
    }

    const path = new URL(request.url).pathname;
    const now = Date.now();
    const max = isAuthPath(path) ? config.authRateLimitMax : config.rateLimitMax;
    const key = rateLimitKey(request, path);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + config.rateLimitWindowMs });
      return;
    }

    bucket.count++;
    if (bucket.count > max) {
      set.headers["retry-after"] = String(Math.ceil((bucket.resetAt - now) / 1000));
      return status(429, { error: "Too many requests" });
    }
  })
  .as("global");
