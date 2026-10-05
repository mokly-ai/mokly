/** Exhaustively compile the accepted graph with the ordinary Build pipeline. */
import { compileCatalogue, type Compilation } from "./compile.js";
import { runtimeGraph, type ComponentRuntime } from "./component_runtime.js";
import { rememberBundle } from "./consumer_bundle.js";
import type { BuildWarning } from "./warnings.js";

export async function compileRuntime(
  runtime: ComponentRuntime,
  checkpoint: () => Promise<void>,
  onWarning?: (warning: BuildWarning) => void,
): Promise<Compilation> {
  const graph = runtimeGraph(runtime);
  rememberBundle(graph, runtime.bundle);
  return compileCatalogue(
    runtime.config,
    {
      graph,
      checkpoint,
      outputSnapshot: runtime.outputSnapshot,
    },
    undefined,
    onWarning,
  );
}
