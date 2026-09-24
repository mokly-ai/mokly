import path from "node:path";

import type { Metafile } from "esbuild";

import { toPosixPath } from "../../config/paths.js";

/** Ordered, first-reachable CSS files for a JavaScript delivery root. */
export function orderedStyles(
  metafile: Metafile,
  root: string,
  workingDir: string,
  excluded: ReadonlySet<string> = new Set(),
): string[] {
  const seen = new Set<string>();
  const styles = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    if (file.endsWith(".css")) {
      const absolute = path.resolve(workingDir, file);
      if (!excluded.has(absolute)) styles.add(absolute);
    }
    for (const imported of metafile.inputs[file]?.imports ?? []) {
      if (imported.external) continue;
      visit(imported.path);
    }
  };
  visit(toPosixPath(path.relative(workingDir, root)));
  return [...styles];
}
