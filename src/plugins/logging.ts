import { Elysia, ElysiaCustomStatusResponse } from "elysia";
import { config } from "../config.js";

const starts = new WeakMap<Request, number>();

const pathOf = (request: Request) => {
  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
};

const publicError = (status: number) => {
  if (status === 400 || status === 422) return "Invalid request";
  if (status === 401) return "Unauthorized";
  if (status === 403) return "Forbidden";
  if (status === 404) return "Not found";
  return "Internal server error";
};

const statusFromCode = (code: string | number) => {
  if (typeof code === "number") return code;
  if (code === "VALIDATION") return 400;
  if (code === "NOT_FOUND") return 404;
  return 500;
};

const responseStatus = (responseValue: unknown, setStatus: unknown) => {
  if (responseValue instanceof ElysiaCustomStatusResponse) {
    return Number(responseValue.code);
  }
  return typeof setStatus === "number" ? setStatus : 200;
};

export const loggingPlugin = new Elysia({ name: "logging" })
  .onRequest(({ request }) => {
    if (!config.isProduction) starts.set(request, performance.now());
  })
  .mapResponse(({ request, responseValue, set }) => {
    if (config.isProduction) return;
    const started = starts.get(request) ?? performance.now();
    const ms = Math.round((performance.now() - started) * 10) / 10;
    const status = responseStatus(responseValue, set.status);
    console.info("[cadence_api]", {
      method: request.method,
      path: pathOf(request),
      status,
      ms,
    });
  })
  .onError(({ request, error, code, set }) => {
    const status =
      typeof code === "number"
        ? code
        : typeof set.status === "number" && set.status !== 200
          ? set.status
          : statusFromCode(code);

    if (!config.isProduction) {
      const unexpected = status >= 500;
      console.error("[cadence_api:error]", {
        method: request.method,
        path: pathOf(request),
        status,
        code,
        message: unexpected && error instanceof Error ? error.message : undefined,
        stack: unexpected && error instanceof Error ? error.stack : undefined,
      });
    }

    set.status = status;
    return { error: publicError(status) };
  })
  .as("global");
