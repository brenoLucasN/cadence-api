import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./routes/auth.js";
import { habitRoutes } from "./routes/habits.js";
import { eventRoutes } from "./routes/events.js";
import { workoutRoutes } from "./routes/workouts.js";
import { statsRoutes } from "./routes/stats.js";
import { loggingPlugin } from "./plugins/logging.js";
import { securityPlugin, isAllowedOrigin } from "./plugins/security.js";
import { config } from "./config.js";

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

export default app;
