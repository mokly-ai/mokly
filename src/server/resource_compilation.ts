/** Refresh only checked authored membership without mutating accepted generations. */
import type { Compilation } from "../build/compile.js";
import { MANIFEST_NAME, serializeManifest } from "../registry/manifest.js";

import type { PreparedResourceWatch } from "./resource_watcher.js";

export function refreshResourceCompilation(
  compilation: Compilation,
  resources?: PreparedResourceWatch,
): Compilation {
  if (!resources?.valid) return compilation;
  const assetClosure = [...resources.closure].sort();
  if (
    assetClosure.length === compilation.manifest.assetClosure.length &&
    assetClosure.every(
      (file, index) => file === compilation.manifest.assetClosure[index],
    )
  )
    return compilation;
  const manifest = { ...compilation.manifest, assetClosure };
  const outputs = new Map(compilation.outputs);
  outputs.set(MANIFEST_NAME, serializeManifest(manifest));
  return { ...compilation, manifest, outputs };
}
