import { invalidData, record } from "../components/data.js";
import { isSafeCatalogueRoute, isSafeRepositoryPath } from "../data/paths.js";
import { isCatalogueId } from "../navigation/logical.js";

export function object(value: unknown): Record<string, unknown> {
  if (!record(value)) invalidData("$catalogue", "expected an object");
  return value;
}
export function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) invalidData("$catalogue", "expected an array");
  return value;
}
export function string(value: unknown): string {
  if (typeof value !== "string") invalidData("$catalogue", "expected a string");
  return value;
}
export function text(value: unknown): string {
  const result = string(value);
  if (!result.trim()) invalidData("$catalogue", "expected nonempty text");
  return result;
}
export function boolean(value: unknown): boolean {
  if (typeof value !== "boolean")
    invalidData("$catalogue", "expected a boolean");
  return value;
}
export function counter(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    invalidData("$catalogue", "expected a nonnegative safe integer");
  return value;
}
export function choice<T extends string>(
  value: unknown,
  choices: readonly T[],
): T {
  if (!choices.includes(value as T))
    invalidData("$catalogue", "unsupported discriminant");
  return value as T;
}
export function id(value: unknown): string {
  if (!isCatalogueId(value)) invalidData("$catalogue", "invalid entry id");
  return value;
}
export function hash(value: unknown): string {
  const result = string(value);
  if (!/^[a-f0-9]{64}$/.test(result))
    invalidData("$catalogue", "invalid identity");
  return result;
}
export function repositoryPath(value: unknown): string {
  const result = text(value);
  if (!isSafeRepositoryPath(result))
    invalidData("$catalogue", "expected repository-relative path");
  return result;
}
export function route(value: unknown): string {
  const result = text(value);
  if (!isSafeCatalogueRoute(result)) invalidData("$catalogue", "invalid route");
  return result;
}
export function publicPath(value: unknown): string | null {
  if (value === null) return null;
  const result = repositoryPath(value);
  if (!result.startsWith("static/") || /[?#]/.test(result))
    invalidData("$catalogue", "invalid public path");
  return result;
}
export function comparisonPath(value: unknown): string | null {
  if (value === null) return null;
  const result = string(value);
  if (
    !/^__mokly\/diffs\/__generations\/[a-f0-9]{64}\/review\.json$/.test(result)
  )
    invalidData("$catalogue", "invalid comparison path");
  return result;
}
export function relatedDoc(value: unknown): string {
  const result = text(value);
  if (/^https?:\/\//.test(result)) {
    const url = new URL(result);
    if (url.username || url.password)
      invalidData("$catalogue", "credentials are private");
    return result;
  }
  return repositoryPath(result);
}
export function unique(values: readonly string[]): void {
  if (new Set(values).size !== values.length)
    invalidData("$catalogue", "duplicate reference");
}
export function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
