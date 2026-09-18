import fs from "node:fs";
import path from "node:path";

import {
  isSafeCatalogueRoute,
  isSafeRepositoryPath,
  isCatalogueId,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { isInside } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";

import type { RegistryViolation } from "./prepared_types.js";

/** Create one source-attributed registry violation. */
export function problem(
  entry: ResolvedRegistryEntry,
  code: string,
  message: string,
): RegistryViolation {
  return {
    code,
    id: entry.id,
    message,
    sourceRelativePath: entry.sourceRelativePath,
  };
}

export function validateRoute(
  entry: ResolvedRegistryEntry,
  violations: RegistryViolation[],
): void {
  const route = "route" in entry ? entry.route : "";
  const invalid = !nonEmpty(route) || !isSafeCatalogueRoute(route);
  if (invalid) {
    violations.push(
      problem(
        entry,
        "invalid-route",
        "route must use portable URL-safe segments and end in .html",
      ),
    );
  }
  if (entry.kind === "screen" && route.endsWith("/index.html")) {
    violations.push(
      problem(entry, "invalid-route", "screen routes must name the screen"),
    );
  }
  if (entry.kind === "use-case" && !route.startsWith("user-flows/")) {
    violations.push(
      problem(
        entry,
        "invalid-route",
        "use-case routes must live under user-flows/",
      ),
    );
  }
}

export function validateTags(
  entry: ResolvedRegistryEntry,
  violations: RegistryViolation[],
): void {
  if (entry.kind === "collection") {
    if ("tags" in entry) {
      violations.push(
        problem(entry, "invalid-tags", "tags are not supported on collections"),
      );
    }
    return;
  }
  const tags = entry.tags;
  if (tags === undefined) return;
  if (!Array.isArray(tags) || !tags.every(isCatalogueId)) {
    violations.push(
      problem(
        entry,
        "invalid-tags",
        "tags must be an array of lowercase kebab-case strings",
      ),
    );
    return;
  }
  if (new Set(tags).size !== tags.length) {
    violations.push(
      problem(entry, "invalid-tags", "tags must not contain duplicates"),
    );
  }
}

export function validatePaths(
  entry: ResolvedRegistryEntry,
  field: "dependencies" | "relatedDocs",
  values: unknown,
  config: ResolvedConfig,
  violations: RegistryViolation[],
): void {
  if (!validateTextList(entry, field, values, true, violations)) return;
  for (const value of values) {
    if (!isSafeRepositoryPath(value)) {
      violations.push(
        problem(
          entry,
          `invalid-${field}`,
          `${field} path must be a safe repository-relative path: ${value}`,
        ),
      );
      continue;
    }
    const candidate = path.resolve(config.repoRoot, value);
    if (!isInside(config.repoRoot, candidate) || !fs.existsSync(candidate)) {
      violations.push(
        problem(
          entry,
          `missing-${field}`,
          `${field} path does not exist: ${value}`,
        ),
      );
    }
  }
}

export function validateTextList(
  entry: ResolvedRegistryEntry,
  field: string,
  value: unknown,
  allowEmpty: boolean,
  violations: RegistryViolation[],
): value is readonly string[] {
  const invalid =
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    !value.every(nonEmpty);
  if (invalid) {
    violations.push(
      problem(
        entry,
        "invalid-metadata",
        `${field} must be ${allowEmpty ? "an" : "a non-empty"} array of strings`,
      ),
    );
    return false;
  }
  return true;
}

export function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validColorSchemes(
  value: unknown,
): value is readonly ("dark" | "light")[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((scheme) => scheme === "light" || scheme === "dark") &&
    new Set(value).size === value.length &&
    value.includes("light")
  );
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
