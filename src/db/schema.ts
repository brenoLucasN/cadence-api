import { boolean, integer, jsonb, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

const id = () => serial("id").primaryKey();
const createdAt = () =>
  text("created_at").notNull().$defaultFn(() => new Date().toISOString());
const authTimestamp = (name: string) =>
  timestamp(name, { withTimezone: true })
    .notNull()
    .defaultNow();

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  password: text("password"),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name").notNull(),
  image: text("image"),
  createdAt: authTimestamp("created_at"),
  updatedAt: authTimestamp("updated_at"),
});

export const session = pgTable("session", {
  id: id(),
  expiresAt: authTimestamp("expires_at"),
  token: text("token").notNull().unique(),
  createdAt: authTimestamp("created_at"),
  updatedAt: authTimestamp("updated_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const account = pgTable(
  "account",
  {
    id: id(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: authTimestamp("created_at"),
    updatedAt: authTimestamp("updated_at"),
  },
  (t) => [unique().on(t.providerId, t.accountId)],
);

export const verification = pgTable("verification", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: authTimestamp("expires_at"),
  createdAt: authTimestamp("created_at"),
  updatedAt: authTimestamp("updated_at"),
});

export const habits = pgTable("habits", {
  id: id(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("focus"),
  color: text("color").notNull().default("#34D399"),
  // 7 chars '0'|'1', index 0 = Sunday
  days: text("days").notNull().default("1111111"),
  goal: integer("goal").notNull().default(1),
  reminder: text("reminder"), // 'HH:mm' local time
  archived: boolean("archived").notNull().default(false),
  createdAt: createdAt(),
});

export const checks = pgTable(
  "checks",
  {
    id: id(),
    habitId: integer("habit_id").notNull().references(() => habits.id),
    date: text("date").notNull(), // 'YYYY-MM-DD' user-local calendar day
    count: integer("count").notNull().default(1),
  },
  (t) => [unique().on(t.habitId, t.date)],
);

export const events = pgTable("events", {
  id: id(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  notes: text("notes"),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  color: text("color").notNull().default("#60A5FA"),
  createdAt: createdAt(),
});

export const workouts = pgTable("workouts", {
  id: id(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  color: text("color").notNull().default("#FB7185"),
  notes: text("notes"),
  days: text("days").notNull().default("0000000"),
  scheduledTime: text("scheduled_time"),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

export const exercises = pgTable("exercises", {
  id: id(),
  workoutId: integer("workout_id").notNull().references(() => workouts.id),
  name: text("name").notNull(),
  sets: integer("sets").notNull().default(3),
  reps: integer("reps").notNull().default(10),
  weight: integer("weight"), // kg; null = bodyweight
  restSec: integer("rest_sec").notNull().default(60),
  series: jsonb("series").$type<{ type: string; reps: number; weight?: number | null; restSec: number }[]>(),
  position: integer("position").notNull().default(0),
});

export const sessions = pgTable("sessions", {
  id: id(),
  workoutId: integer("workout_id").notNull().references(() => workouts.id),
  userId: integer("user_id").notNull().references(() => users.id),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  notes: text("notes"),
  activeSec: integer("active_sec").notNull().default(0),
  restSec: integer("rest_sec").notNull().default(0),
  volume: integer("volume").notNull().default(0),
  completedSets: integer("completed_sets").notNull().default(0),
  sets: jsonb("sets").$type<{ exerciseName: string; setIndex: number; type: string; reps: number; weight: number; restSec: number; completed: boolean }[]>(),
});
