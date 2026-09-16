/** Render temporary props through the same single-view compiler as saved previews. */
import { encodeProps } from "@mokly/viewer/data";
import type { ComponentRenderRequest } from "@mokly/viewer/data";

import type { ComponentRuntime } from "../../build/component_runtime.js";
import { DocumentCompiler } from "../../build/document_compiler.js";
import type { LoadedGraph } from "../../build/load_graph.js";
import { validateRenderRequest } from "../../components/render_request.js";

import {
  captureRenderBundle,
  type TransientRender,
} from "./transient_assets.js";

const compilers = new WeakMap<ComponentRuntime, DocumentCompiler>();

export function renderTransient(
  runtime: ComponentRuntime,
  graph: LoadedGraph,
  request: ComponentRenderRequest,
): TransientRender {
  const { props } = validateRenderRequest(
    request,
    runtime.manifest,
    runtime.generation,
  );
  let compiler = compilers.get(runtime);
  if (!compiler) {
    compiler = new DocumentCompiler(runtime, graph);
    compilers.set(runtime, compiler);
  }
  const entry = compiler.entries.find(
    (entry) => entry.id === request.componentId,
  );
  if (entry?.kind !== "component") throw new Error("Missing component record");
  const saved = entry.variants.find(
    (variant) => variant.id === request.variantId,
  )!;
  const componentProps = {
    ...props,
    ...Object.fromEntries(
      entry.slots
        .filter((key) => Object.hasOwn(saved.props, key))
        .map((key) => [key, saved.props[key]]),
    ),
  };
  const route = [...compiler.routes].find(
    ([, target]) =>
      target.entryId === entry.id &&
      target.variantId === request.variantId &&
      target.viewport === request.viewport &&
      target.colorScheme === request.colorScheme,
  )![0];
  const document = compiler.render(route, componentProps);
  return {
    route,
    props: encodeProps(props),
    view: document.view!,
    files: captureRenderBundle(
      route,
      new Map([[route, document.html]]),
      runtime.manifest,
      runtime.config,
      (target) =>
        compiler!.routes.has(target)
          ? compiler!.render(target).html
          : undefined,
    ),
  };
}
