import type { Metafile } from "esbuild";

import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { MetafileEdges } from "./metafile-edges.js";
import type { MetafileCursor } from "./metafile-edges.js";
import type { ModulePaths } from "./module-paths.js";
import { PackageFolderLookups } from "./package-folder-lookups.js";
import { ServeEditPaths } from "./serve-edit-paths.js";

/** Share request work while each recorder owns its observations and final commit. */
export function serveEditLookups(
  metafile: Metafile,
  paths: ModulePaths,
  configuration: string,
): ReuseEvidence | undefined {
  const edges = new MetafileEdges(metafile, paths.sourceRoot);
  const aliases = Object.entries(paths.settings.aliases).sort(
    ([a], [b]) => b.length - a.length,
  );
  const mapped = new ServeEditPaths(paths);
  let folders: PackageFolderLookups | undefined;
  const folder = () =>
    (folders ??= new PackageFolderLookups(paths, configuration, (directory) =>
      mapped.cachedScope(directory),
    ));
  let folderValid = true;
  let deferred: MetafileCursor | undefined;
  try {
    for (const event of edges.requests(aliases, configuration)) {
      const folderActive =
        folderValid && deferred === undefined && event.folder;
      if (!event.paths && !folderActive) continue;
      const selection = edges.selection(event.selected);
      if (selection.kind === "own") continue;
      if (event.paths && !mapped.accept(event.request, selection))
        return undefined;
      if (!folderActive) continue;
      if (event.deferred) {
        deferred = { input: event.input, edge: event.edge };
        continue;
      }
      folderValid = folder().accept(event.request, selection);
    }
    if (!mapped.finish()) return undefined;
    if (!folderValid) return undefined;
    if (deferred)
      for (const event of edges.requests(aliases, configuration, deferred)) {
        if (!event.folder) continue;
        const selection = edges.selection(event.selected);
        if (selection.kind === "own") continue;
        if (!folder().accept(event.request, selection)) return undefined;
      }
    return folders
      ? folders.finish()
      : {
          complete: false,
          durable: false,
          uncaptured: "serveEdit",
          inputs: {},
        };
  } catch {
    return undefined;
  }
}
