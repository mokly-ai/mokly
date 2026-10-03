import path from "node:path";

import { Minimatch } from "minimatch";

import { isInside, projectRealPath, toPosixPath } from "./paths.js";
import type { ResolvedConfig } from "./types.js";

const matchers = new WeakMap<readonly string[], readonly Minimatch[]>();

/** Protect current root matches even before a fresh discovery generation is accepted. */
export function matchesRootFile(
  candidate: string,
  config: Pick<ResolvedConfig, "roots">,
  physical = false,
): boolean {
  const absolute = path.resolve(candidate);
  return config.roots.some((root) => {
    const directory = physical ? projectRealPath(root.dir) : root.dir;
    if (absolute === directory || !isInside(directory, absolute)) return false;
    let selected = matchers.get(root.files);
    if (!selected) {
      selected = root.files.map((glob) => new Minimatch(glob, { dot: true }));
      matchers.set(root.files, selected);
    }
    const relative = toPosixPath(path.relative(directory, absolute));
    return selected.some((matcher) => matcher.match(relative));
  });
}
