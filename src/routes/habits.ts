import { Elysia, t } from "elysia";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { habits, checks } from "../db/schema";
import { authPlugin } from "../plugins/auth";
import { boundedText, dateOnly, hexColor, invalidRequest, isValidDateOnly, localTime } from "../validation";

const habitBody = {
  name: boundedText(80),
  icon: t.Optional(t.String({ minLength: 1, maxLength: 32, pattern: "^[a-zA-Z0-9_-]+$" })),
  color: t.Optional(hexColor),
  days: t.Optional(t.String({ pattern: "^[01]{7}$" })),
  goal: t.Optional(t.Integer({ minimum: 1, maximum: 999 })),
  reminder: t.Optional(t.Nullable(localTime)),
};

const habitUpdateBody = {
  name: boundedText(80),
  icon: t.String({ minLength: 1, maxLength: 32, pattern: "^[a-zA-Z0-9_-]+$" }),
  color: hexColor,
  days: t.String({ pattern: "^[01]{7}$" }),
  goal: t.Integer({ minimum: 1, maximum: 999 }),
  reminder: t.Nullable(localTime),
  archived: t.Boolean(),
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

const ownHabit = async (userId: number, id: number) => {
  const [habit] = await db.select().from(habits).where(and(eq(habits.id, id), eq(habits.userId, userId)));
  return habit;
};

export const habitRoutes = new Elysia({ prefix: "/habits" })
  .use(authPlugin)
  .get(
    "/",
    async ({ userId, query, status }) => {
      const date = query.date ?? dateStr(new Date());
      if (!isValidDateOnly(date)) return status(400, invalidRequest);
      const list = await db.select().from(habits).where(eq(habits.userId, userId));
      if (list.length === 0) return [];
      const allChecks = await db
        .select()
        .from(checks)
        .where(inArray(checks.habitId, list.map((h) => h.id)));
      return list.map((h) => {
        const byDate = new Map(
          allChecks.filter((c) => c.habitId === h.id).map((c) => [c.date, c.count]),
        );
        return { ...h, todayCount: byDate.get(date) ?? 0, streak: streak(h, byDate, date) };
      });
    },
    { query: t.Object({ date: t.Optional(dateOnly) }) },
  )
  .post(
    "/",
    async ({ userId, body }) => {
      const [habit] = await db.insert(habits).values({ ...body, userId }).returning();
      return habit;
    },
    {
      body: t.Object(habitBody),
    },
  )
  .patch(
    "/:id",
    async ({ userId, params, body, status }) => {
      if (!(await ownHabit(userId, params.id))) return status(404, { error: "Habit not found" });
      const [habit] = await db.update(habits).set(body).where(eq(habits.id, params.id)).returning();
      return habit;
    },
    {
      params: t.Object({ id: t.Integer() }),
      body: t.Partial(t.Object(habitUpdateBody)),
    },
  )
  .delete(
    "/:id",
    async ({ userId, params, status }) => {
      if (!(await ownHabit(userId, params.id))) return status(404, { error: "Habit not found" });
      await db.delete(checks).where(eq(checks.habitId, params.id));
      await db.delete(habits).where(eq(habits.id, params.id));
      return { ok: true };
    },
    { params: t.Object({ id: t.Integer() }) },
  )
  .put(
    "/:id/check",
    async ({ userId, params, body, status }) => {
      if (!isValidDateOnly(body.date)) return status(400, invalidRequest);
      if (!(await ownHabit(userId, params.id))) return status(404, { error: "Habit not found" });
      if (body.count === 0) {
        await db.delete(checks).where(and(eq(checks.habitId, params.id), eq(checks.date, body.date)));
        return { habitId: params.id, date: body.date, count: 0 };
      }
      const [check] = await db
        .insert(checks)
        .values({ habitId: params.id, date: body.date, count: body.count })
        .onConflictDoUpdate({
          target: [checks.habitId, checks.date],
          set: { count: body.count },
        })
        .returning();
      return check;
    },
    {
      params: t.Object({ id: t.Integer() }),
      body: t.Object({
        date: dateOnly,
        count: t.Integer({ minimum: 0, maximum: 999 }),
      }),
    },
  );
