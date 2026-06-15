import { Elysia, t } from "elysia";
import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "../db";
import { users } from "../db/schema";
import { authPlugin } from "../plugins/auth";
import { boundedText } from "../validation";

const credentials = {
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 8, maxLength: 128 }),
};

const requestHeaders = (headers: Record<string, string | undefined>) => {
  const out = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) out.set(key, value);
  }
  return out;
};

const publicUser = ({ id, email, name }: typeof users.$inferSelect) => ({
  id,
  email,
  name,
});

const publicAuthUser = (user: { id: string | number; email: string; name: string }) => ({
  id: Number(user.id),
  email: user.email,
  name: user.name,
});

const authErrorStatus = (error: unknown, fallback = 400) => {
  if (!isAPIError(error)) return fallback;
  return typeof error.status === "number" ? error.status : fallback;
};

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post(
    "/register",
    async ({ body, headers, status }) => {
      try {
        const result = await auth.api.signUpEmail({
          body,
          headers: requestHeaders(headers),
        });
        if (!result.token) return status(400, { error: "Unable to create account" });
        return { token: result.token, user: publicAuthUser(result.user) };
      } catch (error) {
        return status(authErrorStatus(error), { error: "Unable to create account" });
      }
    },
    { body: t.Object({ ...credentials, name: boundedText(80) }) },
  )
  .post(
    "/login",
    async ({ body, headers, status }) => {
      try {
        const result = await auth.api.signInEmail({
          body,
          headers: requestHeaders(headers),
        });
        return { token: result.token, user: publicAuthUser(result.user) };
      } catch (error) {
        return status(authErrorStatus(error, 401), { error: "Invalid credentials" });
      }
    },
    { body: t.Object(credentials) },
  )
  .use(authPlugin)
  .get("/me", async ({ userId, status }) => {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return status(404, { error: "User not found" });
    return { user: publicUser(user) };
  });
