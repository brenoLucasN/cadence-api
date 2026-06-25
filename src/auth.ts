import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { config } from "./config.js";

const requiredInProduction = (name: string, fallback: string) => {
  const value = process.env[name];
  if (config.isProduction && !value) {
    throw new Error(`${name} is required in production`);
  }
  return value ?? fallback;
};

export const auth = betterAuth({
  appName: "Cadence",
  baseURL: requiredInProduction(
    "BETTER_AUTH_URL",
    `http://localhost:${process.env.PORT ?? 3333}`,
  ),
  secret: requiredInProduction(
    "BETTER_AUTH_SECRET",
    "cadence-dev-secret-at-least-32-characters",
  ),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  logger: {
    disabled: config.isProduction,
    level: "error",
  },
  advanced: {
    database: {
      generateId: "serial",
    },
  },
  plugins: [bearer()],
});
