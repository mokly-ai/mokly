/** Exhaustively compile the accepted graph with the ordinary Build pipeline. */
import type { BuildDiagnostic } from "./build_warnings.js";
import { compileCatalogue, type Compilation } from "./compile.js";
import { runtimeGraph, type ComponentRuntime } from "./component_runtime.js";
import { rememberBundle } from "./consumer_bundle.js";

export async function compileRuntime(
  runtime: ComponentRuntime,
  checkpoint: () => Promise<void>,
  onWarning?: (warning: BuildDiagnostic) => void,
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
