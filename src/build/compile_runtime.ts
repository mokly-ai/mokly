/** Exhaustively compile the accepted graph with the ordinary Build pipeline. */
import { compileCatalogue, type Compilation } from "./compile.js";
import type { ComponentRuntime } from "./component_runtime.js";
import { evaluateBundle, rememberBundle } from "./consumer_bundle.js";
import type { BuildWarning } from "./warnings.js";

export async function compileRuntime(
  runtime: ComponentRuntime,
  checkpoint: () => Promise<void>,
  onWarning?: (warning: BuildWarning) => void,
): Promise<Compilation> {
  const graph = {
    ...evaluateBundle(runtime.bundle),
    entrySources: runtime.bundle.entrySources,
    sourceFiles: runtime.config.sourceFiles ?? [],
  };
  rememberBundle(graph, runtime.bundle);
  return compileCatalogue(runtime.config, { graph, checkpoint }, onWarning);
}
