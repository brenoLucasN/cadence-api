import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () =>
  text("created_at").notNull().$defaultFn(() => new Date().toISOString());

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const habits = sqliteTable("habits", {
  id: id(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("✨"),
  color: text("color").notNull().default("#34D399"),
  // 7 chars '0'|'1', index 0 = Sunday
  days: text("days").notNull().default("1111111"),
  goal: integer("goal").notNull().default(1),
  reminder: text("reminder"), // 'HH:mm' local time
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export const checks = sqliteTable(
  "checks",
  {
    id: id(),
    habitId: integer("habit_id").notNull().references(() => habits.id),
    date: text("date").notNull(), // 'YYYY-MM-DD' user-local calendar day
    count: integer("count").notNull().default(1),
  },
  (t) => [unique().on(t.habitId, t.date)],
);

export const events = sqliteTable("events", {
  id: id(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  notes: text("notes"),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  color: text("color").notNull().default("#60A5FA"),
  createdAt: createdAt(),
});

export const workouts = sqliteTable("workouts", {
  id: id(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  color: text("color").notNull().default("#FB7185"),
  notes: text("notes"),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

export const exercises = sqliteTable("exercises", {
  id: id(),
  workoutId: integer("workout_id").notNull().references(() => workouts.id),
  name: text("name").notNull(),
  sets: integer("sets").notNull().default(3),
  reps: integer("reps").notNull().default(10),
  weight: integer("weight"), // kg; null = bodyweight
  restSec: integer("rest_sec").notNull().default(60),
  position: integer("position").notNull().default(0),
});

export const sessions = sqliteTable("sessions", {
  id: id(),
  workoutId: integer("workout_id").notNull().references(() => workouts.id),
  userId: integer("user_id").notNull().references(() => users.id),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  notes: text("notes"),
});
