/** Render temporary props through the same single-view compiler as saved previews. */
import { encodeProps, generatedResourcePath } from "@mokly/viewer/data";
import type { ComponentRenderRequest } from "@mokly/viewer/data";

import type { ComponentRuntime } from "../../build/component_runtime.js";
import { DocumentCompiler } from "../../build/document_compiler.js";
import type { LoadedGraph } from "../../build/load_graph.js";
import type { AcceptedMoveTargets } from "../../build/move_targets.js";
import { validateRenderRequest } from "../../components/render_request.js";
import { isComponentVariantDefinition } from "../../components/types.js";

import {
  captureRenderBundle,
  type TransientRender,
} from "./transient_assets.js";

const compilers = new WeakMap<ComponentRuntime, DocumentCompiler>();

export function renderTransient(
  runtime: ComponentRuntime,
  graph: LoadedGraph,
  request: ComponentRenderRequest,
  moveTargets?: AcceptedMoveTargets,
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
    (entry) =>
      entry.path === request.componentId &&
      entry.kind === "component" &&
      !isComponentVariantDefinition(entry),
  );
  if (entry?.kind !== "component") throw new Error("Missing component record");
  const saved = compiler.entries.find(
    (candidate) =>
      candidate.kind === "component" &&
      isComponentVariantDefinition(candidate) &&
      candidate.path === request.variantPath &&
      candidate.variantOf === entry.path,
  );
  if (!saved) throw new Error("Missing component variant record");
  const route = [...compiler.routes].find(
    ([, target]) =>
      target.entryId === saved.path &&
      target.viewport === request.viewport &&
      target.colorScheme === request.colorScheme,
  )![0];
  const document = compiler.render(route, props, moveTargets);
  const warnings = [...(document.diagnostics ?? [])];
  const files = captureRenderBundle(
    route,
    new Map([...graph.styleOutputs, [route, document.html]]),
    runtime.manifest,
    runtime.config,
    (target) => {
      if (!compiler!.routes.has(target))
        return compiler!.readGeneratedFile(target);
      const generated = compiler!.render(target, undefined, moveTargets);
      warnings.push(...(generated.diagnostics ?? []));
      return generated.html;
    },
    [
      ...(document.resourceSeeds ?? []).map(({ path }) => path),
      ...(document.assetClosure ?? []),
    ],
  );
  return {
    route: generatedResourcePath(route),
    props: encodeProps(props),
    view: document.view!,
    files,
    ...(warnings.length ? { diagnostics: warnings } : {}),
  };
}
