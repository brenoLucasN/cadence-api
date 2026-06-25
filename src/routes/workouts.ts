import { Elysia, t } from "elysia";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { workouts, exercises, sessions } from "../db/schema.js";
import { authPlugin } from "../plugins/auth.js";
import {
  boundedText,
  hexColor,
  invalidRequest,
  isoUtc,
  isValidIsoUtc,
  optionalNullableText,
} from "../validation.js";

const setType = t.Union([t.Literal("normal"), t.Literal("warmup"), t.Literal("progression"), t.Literal("failure")]);

const exerciseSetBody = t.Object({
  type: t.Optional(setType),
  reps: t.Integer({ minimum: 1, maximum: 999 }),
  weight: t.Optional(t.Nullable(t.Integer({ minimum: 0, maximum: 9999 }))),
  restSec: t.Integer({ minimum: 0, maximum: 3600 }),
});

const exerciseBody = t.Object({
  name: boundedText(80),
  sets: t.Optional(t.Integer({ minimum: 1, maximum: 99 })),
  reps: t.Optional(t.Integer({ minimum: 1, maximum: 999 })),
  weight: t.Optional(t.Nullable(t.Integer({ minimum: 0, maximum: 9999 }))),
  restSec: t.Optional(t.Integer({ minimum: 0, maximum: 3600 })),
  series: t.Optional(t.Array(exerciseSetBody, { maxItems: 99 })),
});

const sessionSetBody = t.Object({
  exerciseName: boundedText(80),
  setIndex: t.Integer({ minimum: 0, maximum: 98 }),
  type: t.Optional(setType),
  reps: t.Integer({ minimum: 0, maximum: 999 }),
  weight: t.Integer({ minimum: 0, maximum: 9999 }),
  restSec: t.Integer({ minimum: 0, maximum: 3600 }),
  completed: t.Boolean({ default: false }),
});

const workoutBody = {
  name: boundedText(80),
  color: t.Optional(hexColor),
  notes: optionalNullableText(2000),
  days: t.Optional(t.RegExp(/^[01]{7}$/)),
  scheduledTime: t.Optional(t.Nullable(t.RegExp(/^([01]\d|2[0-3]):[0-5]\d$/))),
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

type ExerciseSeriesInput = {
  name: string;
  sets?: number;
  reps?: number;
  weight?: number | null;
  restSec?: number;
  series?: { type?: string; reps: number; weight?: number | null; restSec: number }[] | null;
};

const normalizeSeries = (exercise: ExerciseSeriesInput) => {
  if (exercise.series && exercise.series.length > 0) {
    return exercise.series.map((set) => ({
      type: set.type ?? "normal",
      reps: set.reps,
      weight: set.weight ?? null,
      restSec: set.restSec,
    }));
  }
  return Array.from({ length: exercise.sets ?? 3 }, () => ({
    type: "normal",
    reps: exercise.reps ?? 10,
    weight: exercise.weight ?? null,
    restSec: exercise.restSec ?? 60,
  }));
};

const sessionMetrics = (sets: (typeof sessionSetBody.static)[] = []) => {
  const completed = sets.filter((set) => set.completed);
  return {
    activeSec: completed.reduce((sum, set) => sum + set.reps, 0),
    restSec: completed.reduce((sum, set) => sum + set.restSec, 0),
    volume: completed.reduce((sum, set) => sum + set.weight * set.reps, 0),
    completedSets: completed.length,
  };
};

const workoutEstimate = (workout: typeof workouts.$inferSelect, items: (typeof exercises.$inferSelect)[]) => {
  const allSets = items.flatMap((exercise) => normalizeSeries({
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    weight: exercise.weight,
    restSec: exercise.restSec,
    series: exercise.series ?? undefined,
  }));
  const activeSec = allSets.reduce((sum, set) => sum + set.reps, 0);
  const restSec = allSets.reduce((sum, set) => sum + set.restSec, 0);
  const volume = allSets.reduce((sum, set) => sum + (set.weight ?? 0) * set.reps, 0);
  return { workoutId: workout.id, activeSec, restSec, totalSec: activeSec + restSec, volume, sets: allSets.length };
};

const insertExercises = async (workoutId: number, items: (typeof exerciseBody.static)[]) => {
  if (items.length === 0) return;
  await db
    .insert(exercises)
    .values(items.map((e, position) => {
      const series = normalizeSeries(e);
      return {
        name: e.name,
        sets: series.length,
        reps: series[0]?.reps ?? e.reps,
        weight: series[0]?.weight ?? e.weight,
        restSec: series[0]?.restSec ?? e.restSec,
        series,
        workoutId,
        position,
      };
    }))
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
          const [workout] = await db.insert(workouts).values({ userId, name: body.name, color: body.color, notes: body.notes, days: body.days, scheduledTime: body.scheduledTime }).returning();
          await insertExercises(workout.id, items);
          return (await withExercises([workout]))[0];
        },
        { body: t.Object({ ...workoutBody, exercises: t.Array(exerciseBody, { default: [] }) }) },
      )
      .patch(
        "/:id",
        async ({ userId, params, body: { exercises: items, ...body }, status }) => {
          const id = Number(params.id);
          const existing = await ownWorkout(userId, id);
          if (!existing) return status(404, { error: "Workout not found" });
          const workout = Object.keys(body).length
            ? (await db.update(workouts).set(body as Partial<typeof workouts.$inferInsert>).where(eq(workouts.id, id)).returning())[0]
            : existing;
          if (items) {
            await db.delete(exercises).where(eq(exercises.workoutId, id));
            await insertExercises(id, items);
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
          const id = Number(params.id);
          if (!(await ownWorkout(userId, id))) return status(404, { error: "Workout not found" });
          await db.delete(sessions).where(eq(sessions.workoutId, id));
          await db.delete(exercises).where(eq(exercises.workoutId, id));
          await db.delete(workouts).where(eq(workouts.id, id));
          return { ok: true };
        },
        { params: t.Object({ id: t.Integer() }) },
      )
      .get(
        "/:id/metrics",
        async ({ userId, params, status }) => {
          const id = Number(params.id);
          const workout = await ownWorkout(userId, id);
          if (!workout) return status(404, { error: "Workout not found" });
          const items = await db.select().from(exercises).where(eq(exercises.workoutId, id)).orderBy(exercises.position);
          return workoutEstimate(workout, items);
        },
        { params: t.Object({ id: t.Integer() }) },
      )
      .post(
        "/:id/sessions",
        async ({ userId, params, body, status }) => {
          const id = Number(params.id);
          if (!validSessionTime(body)) return status(400, invalidRequest);
          if (!(await ownWorkout(userId, id))) return status(404, { error: "Workout not found" });
          const sessionSets = body.sets?.map((set) => ({ ...set, type: set.type ?? "normal" }));
          const metrics = sessionMetrics(sessionSets);
          const [session] = await db
            .insert(sessions)
            .values({
              startedAt: body.startedAt,
              finishedAt: body.finishedAt,
              notes: body.notes,
              sets: sessionSets,
              ...metrics,
              workoutId: id,
              userId,
            })
            .returning();
          return session;
        },
        {
          params: t.Object({ id: t.Integer() }),
          body: t.Object({
            startedAt: isoUtc,
            finishedAt: t.Optional(t.Nullable(isoUtc)),
            notes: optionalNullableText(2000),
            sets: t.Optional(t.Array(sessionSetBody, { maxItems: 500 })),
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
