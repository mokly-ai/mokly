import path from "node:path";

import type { Metafile } from "esbuild";

import { locatePath } from "../../config/file_locations.js";
import { toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError } from "../../errors.js";
import { metafilePath } from "../metafile_paths.js";

/** Reject CSS reached through JavaScript before a virtual CSS entry can leak. */
export function validateRootStyleImports(
  config: ResolvedConfig,
  metafile: Metafile,
  roots: readonly {
    readonly path: string;
    readonly styles: readonly string[];
  }[],
  workingDir: string,
): void {
  const edges = Object.entries(metafile.inputs).flatMap(([input, record]) =>
    record.imports
      .filter((edge) => !edge.external && edge.kind !== "import-rule")
      .map((edge) => ({
        importer: metafilePath(workingDir, input),
        target: metafilePath(workingDir, edge.path),
        original: edge.original,
      })),
  );
  for (const root of roots) {
    for (const file of root.styles) {
      if (locatePath(file, config.repoRoot)) continue;
      const edge = edges.find((candidate) => candidate.target === file);
      const importer = edge?.importer ?? root.path;
      const specifier =
        edge?.original ??
        toPosixPath(path.relative(path.dirname(importer), file));
      throw new MoklyError(
        "build-invalid",
        `CSS import is outside repoRoot in ${toPosixPath(path.relative(config.repoRoot, importer))}: ${specifier}; move the stylesheet inside repoRoot or remove the import`,
      );
    }
  }
}
