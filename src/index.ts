import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./routes/auth";
import { habitRoutes } from "./routes/habits";
import { eventRoutes } from "./routes/events";
import { workoutRoutes } from "./routes/workouts";
import { statsRoutes } from "./routes/stats";

export const app = new Elysia()
  .use(cors())
  .get("/health", () => ({ ok: true }))
  .use(authRoutes)
  .use(habitRoutes)
  .use(eventRoutes)
  .use(workoutRoutes)
  .use(statsRoutes);

if (import.meta.main) {
  app.listen(Number(process.env.PORT ?? 3333));
  console.log(`🥁 cadence_api on http://localhost:${app.server?.port}`);
}
