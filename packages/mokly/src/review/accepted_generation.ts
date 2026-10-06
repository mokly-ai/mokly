import type { Compilation } from "../build/compile.js";
import type { GeneratedFile } from "../build/generated_file.js";
import type { LoadedGraph } from "../build/load_graph.js";
import { isValidGeneratedRoute } from "../build/styles/routes.js";
import { isDocumentResource } from "../documents/resource_paths.js";

/** Immutable accepted CSS/asset scope used by one Changes classification. */
export interface AcceptedGeneration {
  readonly routes: readonly string[];
  readonly outputs?: ReadonlyMap<string, GeneratedFile>;
  readonly deliveredStyleSources: readonly string[];
  readonly documentMarkdown?: ReadonlyMap<string, string>;
}

/** Pin one completed compilation's generated evidence before another edit. */
export function acceptedGenerationFromCompilation(
  compilation: Compilation,
): AcceptedGeneration {
  return {
    routes: [...compilation.outputs.keys()]
      .filter(
        (route) => isValidGeneratedRoute(route) || isDocumentResource(route),
      )
      .sort(),
    outputs: compilation.outputs,
    deliveredStyleSources: compilation.deliveredStyleSources,
    ...(compilation.documentMarkdown
      ? { documentMarkdown: compilation.documentMarkdown }
      : {}),
  };
}

/** Reuse one validated inventory load when accepted bytes are read from disk. */
export function acceptedGenerationFromInventory(
  graph: Pick<
    LoadedGraph,
    "styleOutputs" | "deliveredStyleSources" | "documents"
  >,
): AcceptedGeneration {
  return {
    routes: [...graph.styleOutputs.keys()]
      .filter(
        (route) => isValidGeneratedRoute(route) || isDocumentResource(route),
      )
      .sort(),
    deliveredStyleSources: graph.deliveredStyleSources,
    documentMarkdown: new Map(
      (graph.documents ?? []).map((entry) => [
        entry.sourceRelativePath,
        entry.markdown,
      ]),
    ),
  };
}
