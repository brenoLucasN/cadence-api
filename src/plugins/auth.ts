import { Elysia } from "elysia";
import { auth } from "../auth";

const requestHeaders = (headers: Record<string, string | undefined>) => {
  const out = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) out.set(key, value);
  }
  return out;
};

export const authPlugin = new Elysia({ name: "auth" }).derive(
  { as: "scoped" },
  async ({ headers, status }) => {
    const session = await auth.api.getSession({
      headers: requestHeaders(headers),
    });

    if (!session) throw status(401, { error: "Unauthorized" });

    return { userId: Number(session.user.id) };
  },
);
