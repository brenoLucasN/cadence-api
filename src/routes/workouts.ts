import { Elysia, t } from "elysia";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "../db";
import { workouts, exercises, sessions } from "../db/schema";
import { authPlugin } from "../plugins/auth";

const exerciseBody = t.Object({
  name: t.String({ minLength: 1 }),
  sets: t.Optional(t.Integer({ minimum: 1 })),
  reps: t.Optional(t.Integer({ minimum: 1 })),
  weight: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
  restSec: t.Optional(t.Integer({ minimum: 0 })),
});

const workoutBody = {
  name: t.String({ minLength: 1 }),
  color: t.Optional(t.String()),
  notes: t.Optional(t.Nullable(t.String())),
};

const ownWorkout = (userId: number, id: number) =>
  db.select().from(workouts).where(and(eq(workouts.id, id), eq(workouts.userId, userId))).get();

const withExercises = (list: (typeof workouts.$inferSelect)[]) => {
  if (list.length === 0) return [];
  const all = db
    .select()
    .from(exercises)
    .where(inArray(exercises.workoutId, list.map((w) => w.id)))
    .orderBy(exercises.position)
    .all();
  return list.map((w) => ({ ...w, exercises: all.filter((e) => e.workoutId === w.id) }));
};

const insertExercises = (workoutId: number, items: (typeof exerciseBody.static)[]) => {
  if (items.length === 0) return;
  db.insert(exercises)
    .values(items.map((e, position) => ({ ...e, workoutId, position })))
    .run();
};

export const workoutRoutes = new Elysia()
  .use(authPlugin)
  .group("/workouts", (app) =>
    app
      .get("/", ({ userId }) =>
        withExercises(
          db.select().from(workouts).where(eq(workouts.userId, userId)).orderBy(workouts.position).all(),
        ),
      )
      .post(
        "/",
        ({ userId, body: { exercises: items, ...body } }) => {
          const workout = db.insert(workouts).values({ ...body, userId }).returning().get();
          insertExercises(workout.id, items);
          return withExercises([workout])[0];
        },
        { body: t.Object({ ...workoutBody, exercises: t.Array(exerciseBody, { default: [] }) }) },
      )
      .patch(
        "/:id",
        ({ userId, params, body: { exercises: items, ...body }, status }) => {
          if (!ownWorkout(userId, params.id)) return status(404, { error: "Workout not found" });
          const workout = Object.keys(body).length
            ? db.update(workouts).set(body).where(eq(workouts.id, params.id)).returning().get()
            : ownWorkout(userId, params.id)!;
          if (items) {
            db.delete(exercises).where(eq(exercises.workoutId, params.id)).run();
            insertExercises(params.id, items);
          }
          return withExercises([workout])[0];
        },
        {
          params: t.Object({ id: t.Integer() }),
          body: t.Partial(t.Object({ ...workoutBody, exercises: t.Array(exerciseBody) })),
        },
      )
      .delete(
        "/:id",
        ({ userId, params, status }) => {
          if (!ownWorkout(userId, params.id)) return status(404, { error: "Workout not found" });
          db.delete(sessions).where(eq(sessions.workoutId, params.id)).run();
          db.delete(exercises).where(eq(exercises.workoutId, params.id)).run();
          db.delete(workouts).where(eq(workouts.id, params.id)).run();
          return { ok: true };
        },
        { params: t.Object({ id: t.Integer() }) },
      )
      .post(
        "/:id/sessions",
        ({ userId, params, body, status }) => {
          if (!ownWorkout(userId, params.id)) return status(404, { error: "Workout not found" });
          return db
            .insert(sessions)
            .values({ ...body, workoutId: params.id, userId })
            .returning()
            .get();
        },
        {
          params: t.Object({ id: t.Integer() }),
          body: t.Object({
            startedAt: t.String(),
            finishedAt: t.Optional(t.Nullable(t.String())),
            notes: t.Optional(t.Nullable(t.String())),
          }),
        },
      ),
  )
  .get(
    "/sessions",
    ({ userId, query }) => {
      const filters = [eq(sessions.userId, userId)];
      if (query.from) filters.push(gte(sessions.startedAt, query.from));
      if (query.to) filters.push(lt(sessions.startedAt, query.to));
      return db.select().from(sessions).where(and(...filters)).orderBy(sessions.startedAt).all();
    },
    { query: t.Object({ from: t.Optional(t.String()), to: t.Optional(t.String()) }) },
  );
