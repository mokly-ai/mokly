import { isSafeCatalogueRoute, isSafeRepositoryPath } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

/** Validate a portable routed catalogue URL. */
export function validateRoute(route: string, label: string): void {
  if (!isSafeCatalogueRoute(route)) {
    throw new MoklyError("manifest-invalid", `${label} has an unsafe route`);
  }
}

/** Narrow a manifest string-array field. */
export function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0)
  );
}

/** Narrow a required text field. */
export function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Validate one repository-relative inventory or metadata path. */
export function validateRepoPath(value: string, label: string): void {
  if (!isSafeRepositoryPath(value)) {
    throw new MoklyError(
      "manifest-invalid",
      `${label} must be a safe repository-relative path`,
    );
  }
}

/** Narrow an object boundary before reading manifest fields. */
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
