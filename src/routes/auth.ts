import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { authPlugin, JWT_SECRET } from "../plugins/auth";

const credentials = {
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 8 }),
};

const publicUser = ({ id, email, name }: typeof users.$inferSelect) => ({ id, email, name });

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(jwt({ name: "jwt", secret: JWT_SECRET }))
  .post(
    "/register",
    async ({ body, jwt, status }) => {
      const exists = db.select().from(users).where(eq(users.email, body.email)).get();
      if (exists) return status(400, { error: "Email already registered" });
      const user = db
        .insert(users)
        .values({ ...body, password: await Bun.password.hash(body.password) })
        .returning()
        .get();
      return { token: await jwt.sign({ sub: String(user.id) }), user: publicUser(user) };
    },
    { body: t.Object({ ...credentials, name: t.String({ minLength: 1 }) }) },
  )
  .post(
    "/login",
    async ({ body, jwt, status }) => {
      const user = db.select().from(users).where(eq(users.email, body.email)).get();
      if (!user || !(await Bun.password.verify(body.password, user.password)))
        return status(401, { error: "Invalid credentials" });
      return { token: await jwt.sign({ sub: String(user.id) }), user: publicUser(user) };
    },
    { body: t.Object(credentials) },
  )
  .use(authPlugin)
  .get("/me", ({ userId, status }) => {
    const user = db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) return status(404, { error: "User not found" });
    return { user: publicUser(user) };
  });
