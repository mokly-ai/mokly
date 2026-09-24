/** Retained consumer code; evaluation never creates a temporary module file. */
import { createRequire } from "node:module";
import path from "node:path";
import { Script } from "node:vm";

import type { LoadedGraph } from "./load_graph.js";

export interface ConsumerBundle {
  code: string;
  filename: string;
  entrySources: readonly string[];
}
const bundles = new WeakMap<LoadedGraph, ConsumerBundle>();

export function rememberBundle(
  graph: LoadedGraph,
  bundle: ConsumerBundle,
): void {
  bundles.set(graph, bundle);
}
export function consumerBundle(graph: LoadedGraph): ConsumerBundle {
  const bundle = bundles.get(graph);
  if (!bundle) throw new Error("Consumer graph has no retained bundle");
  return bundle;
}
export function evaluateBundle(
  bundle: ConsumerBundle,
): Pick<
  LoadedGraph,
  | "definitions"
  | "renderer"
  | "renderWithComponents"
  | "compatibilityTransformer"
> {
  const module = { exports: {} };
  const run = new Script(
    `(function(exports, require, module, __filename, __dirname) {\n${bundle.code}\n})`,
    { filename: bundle.filename },
  ).runInThisContext() as (
    exports: object,
    require: NodeJS.Require,
    module: { exports: object },
    filename: string,
    dirname: string,
  ) => void;
  run(
    module.exports,
    createRequire(bundle.filename),
    module,
    bundle.filename,
    path.dirname(bundle.filename),
  );
  return module.exports as Pick<
    LoadedGraph,
    | "definitions"
    | "renderer"
    | "renderWithComponents"
    | "compatibilityTransformer"
  >;
}
