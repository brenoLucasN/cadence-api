import { Elysia, t } from "elysia";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "../db";
import { workouts, exercises, sessions } from "../db/schema";
import { authPlugin } from "../plugins/auth";
import {
  boundedText,
  hexColor,
  invalidRequest,
  isoUtc,
  isValidIsoUtc,
  optionalNullableText,
} from "../validation";

const exerciseBody = t.Object({
  name: boundedText(80),
  sets: t.Optional(t.Integer({ minimum: 1, maximum: 99 })),
  reps: t.Optional(t.Integer({ minimum: 1, maximum: 999 })),
  weight: t.Optional(t.Nullable(t.Integer({ minimum: 0, maximum: 9999 }))),
  restSec: t.Optional(t.Integer({ minimum: 0, maximum: 3600 })),
});

const workoutBody = {
  name: boundedText(80),
  color: t.Optional(hexColor),
  notes: optionalNullableText(2000),
};

const ownWorkout = async (userId: number, id: number) => {
  const [workout] = await db.select().from(workouts).where(and(eq(workouts.id, id), eq(workouts.userId, userId)));
  return workout;
};

const withExercises = async (list: (typeof workouts.$inferSelect)[]) => {
  if (list.length === 0) return [];
  const all = await db
    .select()
    .from(exercises)
    .where(inArray(exercises.workoutId, list.map((w) => w.id)))
    .orderBy(exercises.position);
  return list.map((w) => ({ ...w, exercises: all.filter((e) => e.workoutId === w.id) }));
};

const insertExercises = async (workoutId: number, items: (typeof exerciseBody.static)[]) => {
  if (items.length === 0) return;
  await db
    .insert(exercises)
    .values(items.map((e, position) => ({ ...e, workoutId, position })))
};

const validSessionTime = (body: { startedAt: string; finishedAt?: string | null }) => {
  if (!isValidIsoUtc(body.startedAt)) return false;
  if (body.finishedAt !== undefined && body.finishedAt !== null && !isValidIsoUtc(body.finishedAt)) return false;
  if (body.finishedAt && body.startedAt >= body.finishedAt) return false;
  return true;
};

export const workoutRoutes = new Elysia()
  .use(authPlugin)
  .group("/workouts", (app) =>
    app
      .get("/", async ({ userId }) =>
        withExercises(await db.select().from(workouts).where(eq(workouts.userId, userId)).orderBy(workouts.position)),
      )
      .post(
        "/",
        async ({ userId, body: { exercises: items, ...body } }) => {
          const [workout] = await db.insert(workouts).values({ ...body, userId }).returning();
          await insertExercises(workout.id, items);
          return (await withExercises([workout]))[0];
        },
        { body: t.Object({ ...workoutBody, exercises: t.Array(exerciseBody, { default: [] }) }) },
      )
      .patch(
        "/:id",
        async ({ userId, params, body: { exercises: items, ...body }, status }) => {
          const existing = await ownWorkout(userId, params.id);
          if (!existing) return status(404, { error: "Workout not found" });
          const workout = Object.keys(body).length
            ? (await db.update(workouts).set(body).where(eq(workouts.id, params.id)).returning())[0]
            : existing;
          if (items) {
            await db.delete(exercises).where(eq(exercises.workoutId, params.id));
            await insertExercises(params.id, items);
          }
          return (await withExercises([workout]))[0];
        },
        {
          params: t.Object({ id: t.Integer() }),
          body: t.Partial(t.Object({ ...workoutBody, exercises: t.Array(exerciseBody) })),
        },
      )
      .delete(
        "/:id",
        async ({ userId, params, status }) => {
          if (!(await ownWorkout(userId, params.id))) return status(404, { error: "Workout not found" });
          await db.delete(sessions).where(eq(sessions.workoutId, params.id));
          await db.delete(exercises).where(eq(exercises.workoutId, params.id));
          await db.delete(workouts).where(eq(workouts.id, params.id));
          return { ok: true };
        },
        { params: t.Object({ id: t.Integer() }) },
      )
      .post(
        "/:id/sessions",
        async ({ userId, params, body, status }) => {
          if (!validSessionTime(body)) return status(400, invalidRequest);
          if (!(await ownWorkout(userId, params.id))) return status(404, { error: "Workout not found" });
          const [session] = await db
            .insert(sessions)
            .values({ ...body, workoutId: params.id, userId })
            .returning();
          return session;
        },
        {
          params: t.Object({ id: t.Integer() }),
          body: t.Object({
            startedAt: isoUtc,
            finishedAt: t.Optional(t.Nullable(isoUtc)),
            notes: optionalNullableText(2000),
          }),
        },
      ),
  )
  .get(
    "/sessions",
    async ({ userId, query, status }) => {
      if (query.from && !isValidIsoUtc(query.from)) return status(400, invalidRequest);
      if (query.to && !isValidIsoUtc(query.to)) return status(400, invalidRequest);
      if (query.from && query.to && query.from >= query.to) return status(400, invalidRequest);
      const filters = [eq(sessions.userId, userId)];
      if (query.from) filters.push(gte(sessions.startedAt, query.from));
      if (query.to) filters.push(lt(sessions.startedAt, query.to));
      return db.select().from(sessions).where(and(...filters)).orderBy(sessions.startedAt);
    },
    { query: t.Object({ from: t.Optional(isoUtc), to: t.Optional(isoUtc) }) },
  );
