/** The last successfully compiled consumer graph, passed to Serve only in memory. */
import { randomBytes } from "node:crypto";

import type { ManifestV5 } from "@mokly/viewer/data";

import type { ResolvedConfig } from "../config/types.js";
import type { CatalogueIndex } from "../registry/catalogue_index.js";
import { MANIFEST_NAME } from "../registry/manifest.js";

import type { Compilation } from "./compile.js";
import {
  consumerBundle,
  evaluateBundle,
  type ConsumerBundle,
} from "./consumer_bundle.js";
import type { GeneratedFile } from "./generated_file.js";
import type { LoadedGraph } from "./load_graph.js";

export interface ComponentRuntime {
  bundle: ConsumerBundle;
  config: ResolvedConfig;
  generation: string;
  manifest: ManifestV5 | CatalogueIndex;
  outputs: readonly (readonly [string, GeneratedFile])[];
  stylesheetRoutes: readonly (readonly [string, string])[];
  styleOutputs: readonly (readonly [string, GeneratedFile])[];
}
const runtimes = new WeakMap<Compilation, ComponentRuntime>();
export function rememberRuntime(
  compilation: Compilation,
  graph: LoadedGraph,
  config: ResolvedConfig,
): void {
  runtimes.set(compilation, {
    bundle: consumerBundle(graph),
    config,
    generation: randomBytes(16).toString("hex"),
    manifest: compilation.manifest,
    outputs: [...compilation.outputs].filter(
      ([route]) => route !== MANIFEST_NAME,
    ),
    stylesheetRoutes: [...graph.stylesheetRoutes],
    styleOutputs: [...graph.styleOutputs],
  });
}

/** Reconstruct the accepted graph with its retained, binary-safe CSS outputs. */
export function runtimeGraph(runtime: ComponentRuntime): LoadedGraph {
  return {
    ...evaluateBundle(runtime.bundle),
    entrySources: runtime.bundle.entrySources,
    sourceFiles: runtime.config.sourceFiles ?? [],
    stylesheetRoutes: new Map(runtime.stylesheetRoutes),
    styleOutputs: new Map(runtime.styleOutputs),
  };
}
export function componentRuntime(compilation: Compilation): ComponentRuntime {
  const runtime = runtimes.get(compilation);
  if (!runtime) throw new Error("Compilation has no retained consumer runtime");
  return runtime;
}
