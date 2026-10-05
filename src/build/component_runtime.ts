/** The last successfully compiled consumer graph, passed to Serve only in memory. */
import { randomBytes } from "node:crypto";

import type { ManifestV9 } from "@mokly/viewer/data";

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
import type { OutputSnapshot } from "./output_snapshot.js";

export interface ComponentRuntime {
  outputSnapshot: OutputSnapshot;
  bundle: ConsumerBundle;
  config: ResolvedConfig;
  generation: string;
  manifest: ManifestV9 | CatalogueIndex;
  outputs: readonly (readonly [string, GeneratedFile])[];
  stylesheetRoutes: readonly (readonly [string, string])[];
  styleOutputs: readonly (readonly [string, GeneratedFile])[];
  deliveredStyleSources: readonly string[];
}
const runtimes = new WeakMap<Compilation, ComponentRuntime>();
const accepted = new WeakMap<
  ManifestV9,
  { compilation: Compilation; config: string }
>();
export function rememberRuntime(
  compilation: Compilation,
  graph: LoadedGraph,
  config: ResolvedConfig,
  outputSnapshot: OutputSnapshot,
): void {
  accepted.set(compilation.manifest, {
    compilation,
    config: configKey(config),
  });
  runtimes.set(compilation, {
    outputSnapshot,
    bundle: consumerBundle(graph),
    config,
    generation: randomBytes(16).toString("hex"),
    manifest: compilation.manifest,
    outputs: [...compilation.outputs].filter(
      ([route]) => route !== MANIFEST_NAME,
    ),
    stylesheetRoutes: [...graph.stylesheetRoutes],
    styleOutputs: [...graph.styleOutputs],
    deliveredStyleSources: graph.deliveredStyleSources,
  });
}

/** Reconstruct the accepted graph with its retained, binary-safe CSS outputs. */
export function runtimeGraph(runtime: ComponentRuntime): LoadedGraph {
  return {
    ...evaluateBundle(runtime.bundle),
    entrySources: runtime.bundle.entrySources,
    documents: runtime.bundle.documents ?? [],
    sourceFiles: runtime.config.sourceFiles ?? [],
    stylesheetRoutes: new Map(runtime.stylesheetRoutes),
    styleOutputs: new Map(runtime.styleOutputs),
    deliveredStyleSources: runtime.deliveredStyleSources,
  };
}
export function componentRuntime(compilation: Compilation): ComponentRuntime {
  const runtime = runtimes.get(compilation);
  if (!runtime) throw new Error("Compilation has no retained consumer runtime");
  return runtime;
}

/** Reuse the exact accepted bytes when a snapshot receives its producer's manifest. */
export function compilationForManifest(
  manifest: ManifestV9,
  config: ResolvedConfig,
): Compilation | undefined {
  const found = accepted.get(manifest);
  return found?.config === configKey(config) ? found.compilation : undefined;
}

function configKey(config: ResolvedConfig): string {
  const inputs = { ...config };
  delete inputs.sourceFiles;
  delete inputs.configSourceFiles;
  delete inputs.postcssWatchDirectories;
  return JSON.stringify(inputs);
}
