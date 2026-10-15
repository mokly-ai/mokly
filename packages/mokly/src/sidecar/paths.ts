import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

export function logical(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

export function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

/** The caller's selected dependency roots also apply to extracted base trees. */
export function consumerRequire(params: BundleParams) {
  const roots = params.moduleResolution.packageRoots;
  const root = roots.length
    ? path.resolve(params.sourceRoot, roots[0]!)
    : params.sourceRoot;
  const base =
    path.basename(root) === "node_modules" ? path.dirname(root) : root;
  return createRequire(path.join(base, "package.json"));
}

export async function confinedFile(
  root: string,
  file: string,
): Promise<string> {
  const resolved = await fs.realpath(path.resolve(root, file));
  if (!inside(await fs.realpath(root), resolved))
    throw new Error(`source is outside sourceRoot: ${file}`);
  if (!(await fs.stat(resolved)).isFile())
    throw new Error(`source is not a regular file: ${file}`);
  return resolved;
}
