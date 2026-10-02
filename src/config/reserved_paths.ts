import path from "node:path";

import { GENERATED_DIRECTORY } from "../build/styles/routes.js";
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
    return isInside(projectRealPath(root), projectRealPath(candidate));
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
            `stylesheets[${index}].${field} must not reference mokly-generated/: ${stylesheet}; link imported CSS through the renderer instead`,
          );
      }
    }
  }
}
