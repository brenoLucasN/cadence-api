import { describe, expect, it, beforeAll } from "bun:test";

process.env.NODE_ENV = "test";
process.env.USE_PGLITE = "1";
process.env.AUTH_RATE_LIMIT_MAX = "4";
process.env.RATE_LIMIT_MAX = "1000";
const { app } = await import("../src/index");

const json = (method: string, path: string, body?: unknown, token?: string, headers?: Record<string, string>) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );

let token = "";

beforeAll(async () => {
  const res = await json("POST", "/auth/register", {
    email: "a@a.com",
    password: "12345678",
    name: "Breno",
  });
  expect(res.status).toBe(200);
  token = (await res.json()).token;
});

describe("auth", () => {
  it("rejects duplicate email", async () => {
    const res = await json("POST", "/auth/register", {
      email: "a@a.com",
      password: "12345678",
      name: "X",
    });
    expect(res.status).toBe(400);
  });

  it("logs in and reads /auth/me", async () => {
    const login = await json("POST", "/auth/login", { email: "a@a.com", password: "12345678" });
    expect(login.status).toBe(200);
    const me = await json("GET", "/auth/me", undefined, (await login.json()).token);
    expect((await me.json()).user.name).toBe("Breno");
  });

  it("rejects bad password and missing token", async () => {
    expect((await json("POST", "/auth/login", { email: "a@a.com", password: "wrongpass" })).status).toBe(401);
    const missingToken = await json("GET", "/habits");
    expect(missingToken.status).toBe(401);
    expect(await missingToken.json()).toEqual({ error: "Unauthorized" });
  });

  it("sanitizes validation failures", async () => {
    const res = await json("POST", "/auth/login", { email: "not-an-email", password: "short" });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Invalid request" });
  });

  it("sets security headers and rejects oversized bodies", async () => {
    const health = await json("GET", "/health");
    expect(health.headers.get("x-content-type-options")).toBe("nosniff");
    expect(health.headers.get("x-frame-options")).toBe("DENY");

    const large = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "999999",
        },
        body: JSON.stringify({ email: "a@a.com", password: "12345678" }),
      }),
    );
    expect(large.status).toBe(413);
    expect(await large.json()).toEqual({ error: "Payload too large" });
  });

  it("does not reflect disallowed CORS origins", async () => {
    const res = await json("GET", "/health", undefined, undefined, { origin: "https://evil.example" });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rate limits repeated login attempts", async () => {
    await json("POST", "/auth/login", { email: "a@a.com", password: "wrongpass" });
    const limited = await json("POST", "/auth/login", { email: "a@a.com", password: "wrongpass" });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "Too many requests" });
  });
});

describe("habits", () => {
  let habitId = 0;

  it("creates and lists with todayCount and streak", async () => {
    const created = await json("POST", "/habits", { name: "Read", icon: "book" }, token);
    expect(created.status).toBe(200);
    habitId = (await created.json()).id;

    await json("PUT", `/habits/${habitId}/check`, { date: "2026-06-11", count: 1 }, token);
    await json("PUT", `/habits/${habitId}/check`, { date: "2026-06-12", count: 1 }, token);

    const list = await (await json("GET", "/habits?date=2026-06-12", undefined, token)).json();
    expect(list[0].todayCount).toBe(1);
    expect(list[0].streak).toBe(2);
  });

  it("unchecking today keeps yesterday's streak", async () => {
    await json("PUT", `/habits/${habitId}/check`, { date: "2026-06-12", count: 0 }, token);
    const list = await (await json("GET", "/habits?date=2026-06-12", undefined, token)).json();
    expect(list[0].todayCount).toBe(0);
    expect(list[0].streak).toBe(1);
  });

  it("404s on another user's habit", async () => {
    const other = await (
      await json("POST", "/auth/register", { email: "b@b.com", password: "12345678", name: "B" })
    ).json();
    const res = await json("PATCH", `/habits/${habitId}`, { name: "hack" }, other.token);
    expect(res.status).toBe(404);
  });
});

describe("events", () => {
  it("creates and filters by range", async () => {
    await json(
      "POST",
      "/events",
      { title: "Dentist", startsAt: "2026-06-12T14:00:00Z", endsAt: "2026-06-12T15:00:00Z" },
      token,
    );
    const inRange = await (
      await json("GET", "/events?from=2026-06-12T00:00:00Z&to=2026-06-13T00:00:00Z", undefined, token)
    ).json();
    expect(inRange).toHaveLength(1);
    const outRange = await (
      await json("GET", "/events?from=2026-06-13T00:00:00Z&to=2026-06-14T00:00:00Z", undefined, token)
    ).json();
    expect(outRange).toHaveLength(0);
  });

  it("rejects invalid event ranges", async () => {
    const invalid = await json(
      "POST",
      "/events",
      { title: "Bad", startsAt: "2026-06-12T15:00:00Z", endsAt: "2026-06-12T14:00:00Z" },
      token,
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "Invalid request" });
  });
});

describe("workouts", () => {
  it("creates with nested exercises and logs a session", async () => {
    const created = await (
      await json(
        "POST",
        "/workouts",
        { name: "Push A", exercises: [{ name: "Bench", sets: 4, reps: 8, weight: 60 }] },
        token,
      )
    ).json();
    expect(created.exercises).toHaveLength(1);

    const session = await json(
      "POST",
      `/workouts/${created.id}/sessions`,
      { startedAt: "2026-06-12T10:00:00Z", finishedAt: "2026-06-12T11:00:00Z" },
      token,
    );
    expect(session.status).toBe(200);

    const stats = await (await json("GET", "/stats?date=2026-06-12", undefined, token)).json();
    expect(stats.sessionsThisWeek).toBe(1);
    expect(stats.todayTotal).toBe(1);
  });

  it("replaces exercises on patch", async () => {
    const [w] = await (await json("GET", "/workouts", undefined, token)).json();
    const patched = await (
      await json("PATCH", `/workouts/${w.id}`, { exercises: [{ name: "Incline" }, { name: "Dips" }] }, token)
    ).json();
    expect(patched.exercises.map((e: { name: string }) => e.name)).toEqual(["Incline", "Dips"]);
  });

  it("rejects invalid session ranges", async () => {
    const [w] = await (await json("GET", "/workouts", undefined, token)).json();
    const res = await json(
      "POST",
      `/workouts/${w.id}/sessions`,
      { startedAt: "2026-06-12T11:00:00Z", finishedAt: "2026-06-12T10:00:00Z" },
      token,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request" });
  });
});
