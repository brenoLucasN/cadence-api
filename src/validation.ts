import { t } from "elysia";

export const boundedText = (maxLength: number) => t.String({ minLength: 1, maxLength });
export const optionalNullableText = (maxLength: number) =>
  t.Optional(t.Nullable(t.String({ maxLength })));

export const dateOnly = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
export const isoUtc = t.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,3})?Z$",
});
export const localTime = t.String({ pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" });
export const hexColor = t.String({ pattern: "^#[0-9A-Fa-f]{6}$" });

export const isValidDateOnly = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const isValidIsoUtc = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  return date.toISOString() === value || date.toISOString() === value.replace(/Z$/, ".000Z");
};

export const invalidRequest = { error: "Invalid request" };
