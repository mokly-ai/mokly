import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateReviewOut } from "../config/path_validation.js";
import { isInside, projectRealPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";

import { exportError } from "./error.js";
import { RESERVATION_DIRECTORY } from "./reservation.js";

/** Resolve and validate an export target without creating any files. */
export function resolveExportOutput(
  config: ResolvedConfig,
  value: string,
  adapterRoot?: string,
): string {
  if (value.trim() === "")
    throw exportError("Export output must not be empty.");
  const output = path.resolve(path.dirname(config.configPath), value);
  validateReviewOut(output, config, "Export output", "export-invalid");
  const real = projectRealPath(output);
  if (adapterRoot !== undefined) {
    if (adapterRoot.trim() === "")
      throw exportError("Adapter output root must not be empty.");
    const root = path.resolve(path.dirname(config.configPath), adapterRoot);
    const realRoot = projectRealPath(root);
    if (
      output === root ||
      real === realRoot ||
      !isInside(root, output) ||
      !isInside(realRoot, real)
    )
      throw exportError(
        "Export output must remain inside the configured adapter root.",
      );
  }
  const runtime = fileURLToPath(new URL("..", import.meta.url));
  const protectedDirectories = [config.review.outDir, runtime];
  const protectedFiles = [
    config.configPath,
    ...(config.renderer ? [config.renderer] : []),
    ...(config.sourceFiles ?? []).map((name) =>
      path.resolve(config.repoRoot, name),
    ),
    ...config.moduleResolution.packageRoots.map((root) =>
      path.join(root, "package.json"),
    ),
  ];
  const overlaps = protectedDirectories.some((root) =>
    [root, projectRealPath(root)].some(
      (candidate) =>
        isInside(candidate, real) ||
        isInside(real, candidate) ||
        isInside(candidate, output) ||
        isInside(output, candidate),
    ),
  );
  const containsInput = protectedFiles.some(
    (candidate) =>
      isInside(output, candidate) || isInside(real, projectRealPath(candidate)),
  );
  const reserved = [output, real].some((candidate) =>
    path
      .relative(projectRealPath(config.repoRoot), candidate)
      .split(path.sep)
      .some(
        (segment) =>
          segment === ".git" ||
          segment === "node_modules" ||
          segment === RESERVATION_DIRECTORY,
      ),
  );
  if (overlaps || containsInput || reserved)
    throw exportError(
      "Export output overlaps a protected input, runtime, or comparison path.",
    );
  const stat = fs.lstatSync(output, { throwIfNoEntry: false });
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink()))
    throw exportError(
      "Export output must be a real directory, not a file or symlink.",
    );
  return output;
}
