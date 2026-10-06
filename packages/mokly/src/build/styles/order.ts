import type { Metafile } from "esbuild";

import {
  createMetafilePathMapper,
  type MetafilePathMapper,
} from "../metafile_paths.js";

/** Ordered, first-reachable CSS files for a JavaScript delivery root. */
export function orderedStyles(
  metafile: Metafile,
  root: string,
  workingDir: string,
  excluded: ReadonlySet<string> = new Set(),
  mapper: MetafilePathMapper = createMetafilePathMapper(workingDir),
): string[] {
  const seen = new Set<string>();
  const styles = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    if (file.endsWith(".css")) {
      const absolute = mapper.path(file);
      if (!excluded.has(absolute)) styles.add(absolute);
    }
    for (const imported of metafile.inputs[file]?.imports ?? []) {
      if (imported.external) continue;
      visit(imported.path);
    }
  };
  visit(mapper.key(root));
  return [...styles];
}
