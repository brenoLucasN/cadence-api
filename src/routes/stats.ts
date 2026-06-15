import { Elysia, t } from "elysia";
import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db";
import { habits, checks, sessions } from "../db/schema";
import { authPlugin } from "../plugins/auth";
import { streak } from "./habits";
import { dateOnly, invalidRequest, isValidDateOnly } from "../validation";

const dateStr = (d: Date) => d.toISOString().slice(0, 10);

export const statsRoutes = new Elysia()
  .use(authPlugin)
  .get(
    "/stats",
    async ({ userId, query, status }) => {
      const date = query.date ?? dateStr(new Date());
      if (!isValidDateOnly(date)) return status(400, invalidRequest);
      const today = new Date(`${date}T00:00:00Z`);
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - i);
        return d;
      });

      const list = await db
        .select()
        .from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.archived, false)));
      const allChecks = list.length
        ? await db.select().from(checks).where(inArray(checks.habitId, list.map((h) => h.id)))
        : [];

      let todayDone = 0,
        todayTotal = 0,
        weekDone = 0,
        weekTotal = 0,
        bestStreak = 0;
      for (const h of list) {
        const byDate = new Map(
          allChecks.filter((c) => c.habitId === h.id).map((c) => [c.date, c.count]),
        );
        for (const d of weekDates) {
          if (h.days[d.getUTCDay()] !== "1") continue;
          const done = (byDate.get(dateStr(d)) ?? 0) >= h.goal;
          weekTotal++;
          if (done) weekDone++;
          if (dateStr(d) === date) {
            todayTotal++;
            if (done) todayDone++;
          }
        }
        bestStreak = Math.max(bestStreak, streak(h, byDate, date));
      }

      const weekStart = dateStr(weekDates[6]);
      const sessionsThisWeek = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.userId, userId), gte(sessions.startedAt, weekStart)));

      return {
        todayDone,
        todayTotal,
        weekPercent: weekTotal === 0 ? 0 : Math.round((weekDone / weekTotal) * 100),
        bestStreak,
        sessionsThisWeek: sessionsThisWeek.length,
      };
    },
    { query: t.Object({ date: t.Optional(dateOnly) }) },
  );
