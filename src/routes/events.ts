import { Elysia, t } from "elysia";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "../db";
import { events } from "../db/schema";
import { authPlugin } from "../plugins/auth";
import {
  boundedText,
  hexColor,
  invalidRequest,
  isoUtc,
  isValidIsoUtc,
  optionalNullableText,
} from "../validation";

const eventBody = {
  title: boundedText(120),
  notes: optionalNullableText(2000),
  startsAt: isoUtc,
  endsAt: isoUtc,
  color: t.Optional(hexColor),
};

const ownEvent = async (userId: number, id: number) => {
  const [event] = await db.select().from(events).where(and(eq(events.id, id), eq(events.userId, userId)));
  return event;
};

const validRange = (from?: string, to?: string) => {
  if (from && !isValidIsoUtc(from)) return false;
  if (to && !isValidIsoUtc(to)) return false;
  if (from && to && from >= to) return false;
  return true;
};

const validEventTime = (body: { startsAt?: string; endsAt?: string }) => {
  if (body.startsAt && !isValidIsoUtc(body.startsAt)) return false;
  if (body.endsAt && !isValidIsoUtc(body.endsAt)) return false;
  if (body.startsAt && body.endsAt && body.startsAt >= body.endsAt) return false;
  return true;
};

export const eventRoutes = new Elysia({ prefix: "/events" })
  .use(authPlugin)
  .get(
    "/",
    async ({ userId, query, status }) => {
      if (!validRange(query.from, query.to)) return status(400, invalidRequest);
      const filters = [eq(events.userId, userId)];
      if (query.from) filters.push(gte(events.startsAt, query.from));
      if (query.to) filters.push(lt(events.startsAt, query.to));
      return db.select().from(events).where(and(...filters)).orderBy(events.startsAt);
    },
    { query: t.Object({ from: t.Optional(isoUtc), to: t.Optional(isoUtc) }) },
  )
  .post(
    "/",
    async ({ userId, body, status }) => {
      if (!validEventTime(body)) return status(400, invalidRequest);
      const [event] = await db.insert(events).values({ ...body, userId }).returning();
      return event;
    },
    {
      body: t.Object(eventBody),
    },
  )
  .patch(
    "/:id",
    async ({ userId, params, body, status }) => {
      if (!validEventTime(body)) return status(400, invalidRequest);
      if (!(await ownEvent(userId, params.id))) return status(404, { error: "Event not found" });
      const [event] = await db.update(events).set(body).where(eq(events.id, params.id)).returning();
      return event;
    },
    { params: t.Object({ id: t.Integer() }), body: t.Partial(t.Object(eventBody)) },
  )
  .delete(
    "/:id",
    async ({ userId, params, status }) => {
      if (!(await ownEvent(userId, params.id))) return status(404, { error: "Event not found" });
      await db.delete(events).where(eq(events.id, params.id));
      return { ok: true };
    },
    { params: t.Object({ id: t.Integer() }) },
  );
