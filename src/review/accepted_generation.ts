import type { Compilation } from "../build/compile.js";
import type { GeneratedFile } from "../build/generated_file.js";
import type { LoadedGraph } from "../build/load_graph.js";
import { isValidGeneratedRoute } from "../build/styles/routes.js";

/** Immutable accepted CSS/asset scope used by one Changes classification. */
export interface AcceptedGeneration {
  readonly routes: readonly string[];
  readonly outputs?: ReadonlyMap<string, GeneratedFile>;
  readonly deliveredStyleSources: readonly string[];
}

/** Pin one completed compilation's generated evidence before another edit. */
export function acceptedGenerationFromCompilation(
  compilation: Compilation,
): AcceptedGeneration {
  return {
    routes: [...compilation.outputs.keys()]
      .filter(isValidGeneratedRoute)
      .sort(),
    outputs: compilation.outputs,
    deliveredStyleSources: compilation.deliveredStyleSources,
  };
}

/** Reuse one validated inventory load when accepted bytes are read from disk. */
export function acceptedGenerationFromInventory(
  graph: Pick<LoadedGraph, "styleOutputs" | "deliveredStyleSources">,
): AcceptedGeneration {
  return {
    routes: [...graph.styleOutputs.keys()].filter(isValidGeneratedRoute).sort(),
    deliveredStyleSources: graph.deliveredStyleSources,
  };
}
