import fs from "node:fs";
import path from "node:path";

import { MoklyError } from "../errors.js";

import { isInside, projectRealPath } from "./paths.js";

/** Validate an explicit PostCSS configuration path without evaluating it. */
export function validatePostcssPath(
  value: unknown,
  repoRoot: string,
  configDir: string,
): string | undefined {
  if (value === undefined) return;
  const invalidPath = () =>
    new MoklyError(
      "config-invalid",
      `postcss must name a config-relative module inside repoRoot: ${String(value)}; choose an existing .ts, .mts, .js, .mjs or .cjs file`,
    );
  if (
    typeof value !== "string" ||
    !value.trim() ||
    path.isAbsolute(value) ||
    !isInside(repoRoot, path.resolve(configDir, value))
  )
    throw invalidPath();
  const absolute = path.resolve(configDir, value);
  if (
    !/\.(?:ts|mts|js|mjs|cjs)$/.test(absolute) ||
    !fs.statSync(absolute, { throwIfNoEntry: false })?.isFile()
  )
    throw new MoklyError(
      "config-invalid",
      `postcss module must be an existing regular .ts, .mts, .js, .mjs or .cjs file inside repoRoot: ${value}`,
    );
  if (!isInside(projectRealPath(repoRoot), projectRealPath(absolute)))
    throw invalidPath();
  return absolute;
}
