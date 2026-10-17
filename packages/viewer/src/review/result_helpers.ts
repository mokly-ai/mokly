/** Shared strict decoding steps of the review result v8 reader. */

import { canonicalJson } from "../components/data.js";
import { isEntryPath, isKebabCase } from "../navigation/logical.js";

export function reviewInvalid(message: string): never {
  throw new Error(
    message.startsWith("[mokly/review] ")
      ? message
      : `[mokly/review] ${message}`,
  );
}

/**
 * One plain object with exactly the allowed keys. A present optional key holds
 * a value: the canonical form omits an absent field rather than writing null.
 */
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
    [...required, ...optional].some(
      (key) =>
        Object.hasOwn(record, key) &&
        (record[key] === undefined || record[key] === null),
    ) ||
    required.some((key) => !Object.hasOwn(record, key))
  )
    reviewInvalid("required field is missing");
  return record;
}

export function reviewArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) reviewInvalid("expected an array");
  return value;
}

export function reviewString(value: unknown): string {
  if (typeof value !== "string") reviewInvalid("expected a string");
  return value;
}

/** A title: nonempty after trimming. */
export function reviewText(value: unknown): string {
  const text = reviewString(value);
  if (!text.trim()) reviewInvalid("expected a nonempty string");
  return text;
}

export function reviewBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") reviewInvalid("expected a boolean");
  return value;
}

export function reviewChoice<T extends string>(
  value: unknown,
  choices: readonly T[],
): T {
  if (
    typeof value !== "string" ||
    !(choices as readonly string[]).includes(value)
  )
    reviewInvalid("unknown value");
  return value as T;
}

export function reviewEntryPath(value: unknown): string {
  const path = reviewString(value);
  if (!isEntryPath(path)) reviewInvalid("invalid entry path");
  return path;
}

export function reviewIgnoreId(value: unknown): string {
  const id = reviewString(value);
  if (!isKebabCase(id)) reviewInvalid("invalid ReviewIgnore id");
  return id;
}

/** A logical instance key: 64 lowercase hexadecimal digits. */
export function reviewDigest(value: unknown): string {
  const digest = reviewString(value);
  if (!/^[a-f0-9]{64}$/.test(digest)) reviewInvalid("invalid instance key");
  return digest;
}

/** A Git commit: 40 or 64 hexadecimal digits. */
export function reviewCommit(value: unknown): string {
  const commit = reviewString(value);
  if (!/^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/.test(commit))
    reviewInvalid("invalid base commit");
  return commit;
}

/** A public route below `static/`, never a private source path. */
export function reviewResourcePath(value: unknown): string {
  const path = reviewString(value);
  if (
    !path.startsWith("static/") ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    /[\\\0?#]/.test(path)
  )
    reviewInvalid("invalid public route");
  return path;
}

/** ASCII case folding, as the producer pairs paths. */
export function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

/** Require strictly ascending keys: the stated order, with no duplicate. */
export function requireOrdered<T>(
  items: readonly T[],
  key: (value: T) => string,
): void {
  for (let index = 1; index < items.length; index++) {
    if (key(items[index - 1]!) >= key(items[index]!))
      reviewInvalid(`records must be sorted and unique at index ${index}`);
  }
}

export function requireEqual(a: unknown, b: unknown): void {
  if (canonicalJson(a) !== canonicalJson(b))
    reviewInvalid("inconsistent sides or references");
}
