import { inspect } from "node:util";

import { braceExpand } from "minimatch";

import { GENERATED_DIRECTORY } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

/** Validate POSIX globs and brace alternatives; freeze a copy without adding defaults. */
export function validateRelativeGlobs(
  value: unknown,
  label: string,
  reserveGenerated = false,
): readonly string[] {
  if (!Array.isArray(value)) throw invalid(value, label);
  for (const item of value) {
    if (typeof item !== "string" || !safeGlob(item)) throw invalid(item, label);
    let alternatives: string[];
    try {
      alternatives = braceExpand(item);
    } catch {
      throw invalid(item, label);
    }
    if (!alternatives.every(safeGlob)) throw invalid(item, label);
    if (
      reserveGenerated &&
      alternatives.some(
        (alternative) => alternative.split("/")[0] === GENERATED_DIRECTORY,
      )
    )
      throw new MoklyError(
        "config-invalid",
        `${label} must not start with ${GENERATED_DIRECTORY}/: ${item}; narrow the exclusion to consumer-owned paths`,
      );
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

function invalid(item: unknown, label: string): MoklyError {
  let description: string;
  try {
    description = JSON.stringify(item) ?? String(item);
  } catch {
    description = inspect(item);
  }
  return new MoklyError(
    "config-invalid",
    `${label} requires safe relative POSIX globs; invalid item: ${description}`,
  );
}
