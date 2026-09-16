import { inspect } from "node:util";

import { braceExpand } from "minimatch";

import { MoklyError } from "../errors.js";

/** Always-prepended public exclusions, matched relative to mockupsDir. */
export const DEFAULT_PUBLIC_EXCLUDE: readonly string[] = Object.freeze([
  "**/README",
  "**/README.*",
  "**/tsconfig.json",
  "**/tsconfig.*.json",
]);

/** Prepend defaults to validated consumer globs, or return defaults on omission. */
export function resolvePublicExclude(value: unknown): readonly string[] {
  if (value === undefined) return DEFAULT_PUBLIC_EXCLUDE;
  return Object.freeze([
    ...DEFAULT_PUBLIC_EXCLUDE,
    ...validatePublicExclude(value),
  ]);
}

/** Validate POSIX globs and brace alternatives; freeze a copy without adding defaults. */
export function validatePublicExclude(value: unknown): readonly string[] {
  if (!Array.isArray(value)) throw invalid(value);
  for (const item of value) {
    if (typeof item !== "string" || !safeGlob(item)) throw invalid(item);
    let alternatives: string[];
    try {
      alternatives = braceExpand(item);
    } catch {
      throw invalid(item);
    }
    if (!alternatives.every(safeGlob)) throw invalid(item);
  }
  return Object.freeze([...value]);
}

function safeGlob(glob: string): boolean {
  return (
    glob.trim().length > 0 &&
    !/^[!#]/.test(glob) &&
    !/[\\:]/.test(glob) &&
    ![...glob].some(
      (character) =>
        character.charCodeAt(0) < 32 ||
        (character.charCodeAt(0) >= 127 && character.charCodeAt(0) <= 159),
    ) &&
    glob
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

function invalid(item: unknown): MoklyError {
  let description: string;
  try {
    description = JSON.stringify(item) ?? String(item);
  } catch {
    description = inspect(item);
  }
  return new MoklyError(
    "config-invalid",
    `publicExclude requires safe relative POSIX globs; invalid item: ${description}`,
  );
}
