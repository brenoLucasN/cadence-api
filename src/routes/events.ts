import { Elysia, t } from "elysia";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "../db";
import { events } from "../db/schema";
import { authPlugin } from "../plugins/auth";

const eventBody = {
  title: t.String({ minLength: 1 }),
  notes: t.Optional(t.Nullable(t.String())),
  startsAt: t.String(),
  endsAt: t.String(),
  color: t.Optional(t.String()),
};

const ownEvent = (userId: number, id: number) =>
  db.select().from(events).where(and(eq(events.id, id), eq(events.userId, userId))).get();

export const eventRoutes = new Elysia({ prefix: "/events" })
  .use(authPlugin)
  .get(
    "/",
    ({ userId, query }) => {
      const filters = [eq(events.userId, userId)];
      if (query.from) filters.push(gte(events.startsAt, query.from));
      if (query.to) filters.push(lt(events.startsAt, query.to));
      return db.select().from(events).where(and(...filters)).orderBy(events.startsAt).all();
    },
    { query: t.Object({ from: t.Optional(t.String()), to: t.Optional(t.String()) }) },
  )
  .post("/", ({ userId, body }) => db.insert(events).values({ ...body, userId }).returning().get(), {
    body: t.Object(eventBody),
  })
  .patch(
    "/:id",
    ({ userId, params, body, status }) => {
      if (!ownEvent(userId, params.id)) return status(404, { error: "Event not found" });
      return db.update(events).set(body).where(eq(events.id, params.id)).returning().get();
    },
    { params: t.Object({ id: t.Integer() }), body: t.Partial(t.Object(eventBody)) },
  )
  .delete(
    "/:id",
    ({ userId, params, status }) => {
      if (!ownEvent(userId, params.id)) return status(404, { error: "Event not found" });
      db.delete(events).where(eq(events.id, params.id)).run();
      return { ok: true };
    },
    { params: t.Object({ id: t.Integer() }) },
  );
