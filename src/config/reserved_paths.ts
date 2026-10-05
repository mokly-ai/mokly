import path from "node:path";

import { braceExpand } from "minimatch";

import { GENERATED_DIRECTORY } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

import { isInside, projectRealPath } from "./paths.js";
import type { StylesheetRule } from "./types.js";

/** Protect lexical and existing physical aliases; defer broken links to normal path validation. */
export function isReservedConfiguredPath(
  candidate: string,
  mockupsDir: string,
): boolean {
  const root = path.join(mockupsDir, GENERATED_DIRECTORY);
  if (isInside(root, candidate)) return true;
  try {
    return isInside(
      path.join(projectRealPath(mockupsDir), GENERATED_DIRECTORY),
      projectRealPath(candidate),
    );
  } catch {
    return false;
  }
}

/** Reject public stylesheet aliases that resolve to Mokly-owned output. */
export function validateStylesheetAliases(
  rules: readonly StylesheetRule[],
  mockupsDir: string,
): void {
  for (const [index, rule] of rules.entries()) {
    for (const field of [
      "stylesheets",
      "lightStylesheets",
      "darkStylesheets",
    ] as const) {
      for (const stylesheet of rule[field] ?? []) {
        if (/^https?:\/\//.test(stylesheet)) continue;
        if (
          isReservedConfiguredPath(
            path.resolve(mockupsDir, stylesheet),
            mockupsDir,
          )
        )
          throw new MoklyError(
            "config-invalid",
            `stylesheets[${index}].${field} must not reference ${GENERATED_DIRECTORY}/: ${stylesheet}; link imported CSS through the renderer instead`,
          );
      }
    }
  }
}

/** Reject explicit root or file-pattern targets inside reserved generated output. */
export function validateRootReservedPath(
  directory: string,
  configured: string,
  index: number,
  mockupsDir: string,
  files?: readonly string[],
): void {
  if (files === undefined) {
    if (isReservedConfiguredPath(directory, mockupsDir))
      throw new MoklyError(
        "config-invalid",
        `roots[${index}].dir must not select ${GENERATED_DIRECTORY}/: ${configured}; choose a directory of authored entry modules`,
      );
    return;
  }
  for (const glob of files) {
    for (const alternative of braceExpand(glob)) {
      const parts = alternative.split("/");
      const firstGlob = parts.findIndex((part) => /[*?{[(]/.test(part));
      const prefix =
        firstGlob === -1 ? parts.slice(0, -1) : parts.slice(0, firstGlob);
      if (
        isReservedConfiguredPath(path.resolve(directory, ...prefix), mockupsDir)
      )
        throw new MoklyError(
          "config-invalid",
          `roots[${index}].files must not select ${GENERATED_DIRECTORY}/: ${glob}; narrow the file glob to authored files`,
        );
    }
  }
}
