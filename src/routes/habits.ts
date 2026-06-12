import { Elysia, t } from "elysia";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { habits, checks } from "../db/schema";
import { authPlugin } from "../plugins/auth";

const habitBody = {
  name: t.String({ minLength: 1 }),
  icon: t.Optional(t.String()),
  color: t.Optional(t.String()),
  days: t.Optional(t.String({ pattern: "^[01]{7}$" })),
  goal: t.Optional(t.Integer({ minimum: 1 })),
  reminder: t.Optional(t.Nullable(t.String({ pattern: "^\\d{2}:\\d{2}$" }))),
};

const dateStr = (d: Date) => d.toISOString().slice(0, 10);

/** Consecutive scheduled days with a check, walking back from `date`.
 *  An unchecked `date` itself doesn't break the streak (the day isn't over yet). */
export function streak(habit: { days: string }, byDate: Map<string, number>, date: string): number {
  let count = 0;
  const cursor = new Date(`${date}T00:00:00Z`);
  for (let i = 0; i < 366; i++) {
    const day = dateStr(cursor);
    const scheduled = habit.days[cursor.getUTCDay()] === "1";
    if (scheduled) {
      if (byDate.has(day)) count++;
      else if (day !== date) break;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return count;
}

const ownHabit = (userId: number, id: number) =>
  db.select().from(habits).where(and(eq(habits.id, id), eq(habits.userId, userId))).get();

export const habitRoutes = new Elysia({ prefix: "/habits" })
  .use(authPlugin)
  .get(
    "/",
    ({ userId, query }) => {
      const date = query.date ?? dateStr(new Date());
      const list = db.select().from(habits).where(eq(habits.userId, userId)).all();
      if (list.length === 0) return [];
      const allChecks = db
        .select()
        .from(checks)
        .where(inArray(checks.habitId, list.map((h) => h.id)))
        .all();
      return list.map((h) => {
        const byDate = new Map(
          allChecks.filter((c) => c.habitId === h.id).map((c) => [c.date, c.count]),
        );
        return { ...h, todayCount: byDate.get(date) ?? 0, streak: streak(h, byDate, date) };
      });
    },
    { query: t.Object({ date: t.Optional(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })) }) },
  )
  .post("/", ({ userId, body }) => db.insert(habits).values({ ...body, userId }).returning().get(), {
    body: t.Object(habitBody),
  })
  .patch(
    "/:id",
    ({ userId, params, body, status }) => {
      if (!ownHabit(userId, params.id)) return status(404, { error: "Habit not found" });
      return db.update(habits).set(body).where(eq(habits.id, params.id)).returning().get();
    },
    {
      params: t.Object({ id: t.Integer() }),
      body: t.Partial(t.Object({ ...habitBody, archived: t.Boolean() })),
    },
  )
  .delete(
    "/:id",
    ({ userId, params, status }) => {
      if (!ownHabit(userId, params.id)) return status(404, { error: "Habit not found" });
      db.delete(checks).where(eq(checks.habitId, params.id)).run();
      db.delete(habits).where(eq(habits.id, params.id)).run();
      return { ok: true };
    },
    { params: t.Object({ id: t.Integer() }) },
  )
  .put(
    "/:id/check",
    ({ userId, params, body, status }) => {
      if (!ownHabit(userId, params.id)) return status(404, { error: "Habit not found" });
      if (body.count === 0) {
        db.delete(checks)
          .where(and(eq(checks.habitId, params.id), eq(checks.date, body.date)))
          .run();
        return { habitId: params.id, date: body.date, count: 0 };
      }
      return db
        .insert(checks)
        .values({ habitId: params.id, date: body.date, count: body.count })
        .onConflictDoUpdate({
          target: [checks.habitId, checks.date],
          set: { count: body.count },
        })
        .returning()
        .get();
    },
    {
      params: t.Object({ id: t.Integer() }),
      body: t.Object({
        date: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
        count: t.Integer({ minimum: 0 }),
      }),
    },
  );
