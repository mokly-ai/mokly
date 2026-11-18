import { GENERATED_DIRECTORY } from "../generated/catalogue/Namespace.js";
const PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;
const WINDOWS_DEVICE_NAME = /^(?:aux|con|nul|prn|com[1-9]|lpt[1-9])$/i;
const LOGICAL_FRAGMENT = /^[\p{Alphabetic}\p{N}\p{M}_:.-]+$/u;

/** A parsed complete logical catalogue destination. */
export interface LogicalTarget {
  fragment?: string;
  path: string;
}

/** Return whether a value is a reserved Windows device filename stem. */
export function isWindowsDeviceName(value: unknown): value is string {
  return typeof value === "string" && WINDOWS_DEVICE_NAME.test(value);
}

/** Check a portable, case-preserving catalogue path segment. */
export function isPathSegment(value: unknown): value is string {
  return (
    typeof value === "string" &&
    PATH_SEGMENT.test(value) &&
    !isWindowsDeviceName(value)
  );
}

/** Check a complete catalogue path without leading or trailing separators. */
export function isEntryPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.split("/")[0]?.toLowerCase() !== GENERATED_DIRECTORY &&
    value.split("/").every(isPathSegment)
  );
}

/** Check complete or explicitly relative logical paths without coercion. */
export function isLinkPath(value: unknown): value is string {
  if (isEntryPath(value)) return true;
  if (typeof value !== "string" || !/^\.\.?\//.test(value)) return false;
  return value
    .split("/")
    .every(
      (segment) =>
        segment === "." || segment === ".." || isPathSegment(segment),
    );
}

/** Check the bare logical HTML-fragment grammar. */
export function isLogicalFragment(value: unknown): value is string {
  return typeof value === "string" && LOGICAL_FRAGMENT.test(value);
}

/** Parse a complete `mock:<path>[#fragment]` value. */
export function parseLogicalTarget(value: unknown): LogicalTarget | undefined {
  if (typeof value !== "string" || !value.startsWith("mock:")) return undefined;
  const separator = value.indexOf("#", 5);
  const path = separator < 0 ? value.slice(5) : value.slice(5, separator);
  const fragment = separator < 0 ? undefined : value.slice(separator + 1);
  if (
    !isLinkPath(path) ||
    (fragment !== undefined && !isLogicalFragment(fragment))
  )
    return undefined;
  return fragment === undefined ? { path } : { fragment, path };
}

/** Return whether a value is a canonical, portable repository-relative path. */
export function isSafeRepositoryPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes(":") &&
    !value.includes("\0") &&
    !value
      .split("/")
      .some((part) => part === "" || part === "." || part === "..")
  );
}
