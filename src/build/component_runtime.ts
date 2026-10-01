/** The last successfully compiled consumer graph, passed to Serve only in memory. */
import { randomBytes } from "node:crypto";

import type { ManifestV7 } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import type { ResolvedConfig } from "../config/types.js";
import type { CatalogueIndex } from "../registry/catalogue_index.js";
import { MANIFEST_NAME } from "../registry/manifest.js";

import type { Compilation } from "./compile.js";
import { consumerBundle, type ConsumerBundle } from "./consumer_bundle.js";
import type { InteractiveSourceCapture } from "./interactive_source_capture.js";
import type { LoadedGraph } from "./load_graph.js";

export interface ComponentRuntime {
  bundle: ConsumerBundle;
  config: ResolvedConfig;
  generation: string;
  interactiveEntries: Readonly<Record<string, boolean>>;
  interactiveSources?: InteractiveSourceCapture;
  manifest: ManifestV7 | CatalogueIndex;
  outputs: readonly (readonly [string, string])[];
}
const runtimes = new WeakMap<Compilation, ComponentRuntime>();
export function rememberRuntime(
  compilation: Compilation,
  graph: LoadedGraph,
  config: ResolvedConfig,
  entries: readonly ResolvedRegistryEntry[],
): void {
  runtimes.set(compilation, {
    bundle: consumerBundle(graph),
    config,
    generation: randomBytes(16).toString("hex"),
    interactiveEntries: Object.fromEntries(
      entries.flatMap((entry) =>
        entry.kind === "screen" || entry.kind === "component"
          ? [[entry.id, entry.interactive !== false] as const]
          : [],
      ),
    ),
    manifest: compilation.manifest,
    outputs: [...compilation.outputs].filter(
      ([route]) => route !== MANIFEST_NAME,
    ),
  });
}
export function componentRuntime(compilation: Compilation): ComponentRuntime {
  const runtime = runtimes.get(compilation);
  if (!runtime) throw new Error("Compilation has no retained consumer runtime");
  return runtime;
}
