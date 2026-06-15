import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./routes/auth";
import { habitRoutes } from "./routes/habits";
import { eventRoutes } from "./routes/events";
import { workoutRoutes } from "./routes/workouts";
import { statsRoutes } from "./routes/stats";
import { loggingPlugin } from "./plugins/logging";
import { securityPlugin, isAllowedOrigin } from "./plugins/security";
import { config } from "./config";

export const app = new Elysia()
  .use(securityPlugin)
  .use(loggingPlugin)
  .use(
    cors({
      origin: (request) => isAllowedOrigin(request.headers.get("origin")),
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["set-auth-token"],
    }),
  )
  .get("/health", () => ({ ok: true }))
  .use(authRoutes)
  .use(habitRoutes)
  .use(eventRoutes)
  .use(workoutRoutes)
  .use(statsRoutes);

if (import.meta.main) {
  app.listen(config.port);
  if (!config.isProduction) {
    console.log(`cadence_api on http://localhost:${app.server?.port}`);
  }
}
