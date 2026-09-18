import { canonicalJson } from "../components/data.js";

export const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;
export function reviewInvalid(message: string): never {
  throw new Error(`[mokly/review] ${message}`);
}
export function reviewObject(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![null, Object.prototype].includes(Object.getPrototypeOf(value))
  )
    reviewInvalid("expected an object");
  const record = value as Record<string, unknown>;
  const descriptors = Object.getOwnPropertyDescriptors(record);
  if (
    Reflect.ownKeys(descriptors).some(
      (key) =>
        typeof key !== "string" ||
        ![...required, ...optional].includes(key) ||
        !("value" in descriptors[key]!),
    )
  )
    reviewInvalid("unknown or unsafe field");
  if (
    required.some(
      (key) => !Object.hasOwn(record, key) || record[key] === undefined,
    )
  )
    reviewInvalid("required field is missing");
  return record;
}
export function reviewArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) reviewInvalid("expected an array");
  return value;
}
export function reviewString(value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    reviewInvalid("expected a nonempty string");
  return value;
}
export function reviewId(value: unknown): string {
  const id = reviewString(value);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) reviewInvalid("invalid entry id");
  return id;
}
export function reviewPath(value: unknown): string {
  const path = reviewString(value);
  if (
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.split("/").some((part) => !part || part === "." || part === "..")
  )
    reviewInvalid("unsafe path");
  return path;
}
export function reviewRoute(value: unknown): string {
  const route = reviewPath(value);
  if (
    !/^(?:[A-Za-z0-9][A-Za-z0-9._~-]*\/)*[A-Za-z0-9][A-Za-z0-9._~-]*\.html$/.test(
      route,
    )
  )
    reviewInvalid("unsafe route");
  return route;
}
export function reviewStrings(
  value: unknown,
  validate = reviewString,
): string[] {
  const strings = reviewArray(value).map(validate);
  requireOrdered(strings, (value) => value);
  return strings;
}
export function requireOrdered<T>(
  items: readonly T[],
  key: (value: T) => string,
): void {
  for (let index = 1; index < items.length; index++)
    if (key(items[index - 1]!) >= key(items[index]!))
      reviewInvalid("records must be sorted and unique");
}
export function requireEqual(a: unknown, b: unknown): void {
  if (canonicalJson(a) !== canonicalJson(b))
    reviewInvalid("inconsistent sides or references");
}
export function reviewAddress(value: unknown): Record<string, unknown> {
  const entry = reviewObject(value, ["id", "route", "title"]);
  reviewId(entry.id);
  reviewRoute(entry.route);
  reviewString(entry.title);
  return entry;
}
export function reviewSides(record: Record<string, unknown>): void {
  if (!record.before && !record.after)
    reviewInvalid("at least one side is required");
  for (const side of ["before", "after"] as const)
    if (record[side] !== undefined) reviewAddress(record[side]);
}
export function reviewState(value: unknown): void {
  if (
    !["added", "changed", "removed", "ignored-only", "unchanged"].includes(
      String(value),
    )
  )
    reviewInvalid("unknown review state");
}
