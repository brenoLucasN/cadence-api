import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";

export const JWT_SECRET = process.env.JWT_SECRET ?? "cadence-dev-secret";

export const authPlugin = new Elysia({ name: "auth" })
  .use(jwt({ name: "jwt", secret: JWT_SECRET }))
  .derive({ as: "scoped" }, async ({ jwt, headers, status }) => {
    const token = headers.authorization?.replace(/^Bearer /, "");
    const payload = token ? await jwt.verify(token) : false;
    if (!payload) throw status(401, { error: "Unauthorized" });
    return { userId: Number(payload.sub) };
  });
