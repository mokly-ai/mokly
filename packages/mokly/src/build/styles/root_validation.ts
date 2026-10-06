import path from "node:path";

import type { Metafile } from "esbuild";

import { locatePath } from "../../config/file_locations.js";
import { toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError } from "../../errors.js";
import type { MetafilePathMapper } from "../metafile_paths.js";

/** Reject CSS reached through JavaScript before a virtual CSS entry can leak. */
export function validateRootStyleImports(
  config: ResolvedConfig,
  metafile: Metafile,
  roots: readonly {
    readonly path: string;
    readonly styles: readonly string[];
  }[],
  mapper: MetafilePathMapper,
): void {
  for (const root of roots) {
    for (const file of root.styles) {
      if (locatePath(file, config.repoRoot)) continue;
      const edge = Object.entries(metafile.inputs)
        .flatMap(([input, record]) =>
          record.imports
            .filter(
              (imported) =>
                !imported.external && imported.kind !== "import-rule",
            )
            .map((imported) => ({ input, imported })),
        )
        .find(({ imported }) => mapper.path(imported.path) === file);
      const importer = edge ? mapper.path(edge.input) : root.path;
      const specifier =
        edge?.imported.original ??
        toPosixPath(path.relative(path.dirname(importer), file));
      throw new MoklyError(
        "build-invalid",
        `CSS import is outside repoRoot in ${toPosixPath(path.relative(config.repoRoot, importer))}: ${specifier}; move the stylesheet inside repoRoot or remove the import`,
      );
    }
  }
}
