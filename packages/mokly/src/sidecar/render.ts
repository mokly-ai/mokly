import type { ReactNode } from "react";

import { definitionData } from "../authoring/runtime.js";
import type { Renderer } from "../authoring/types.js";
import type { RenderComponentParams } from "../generated/sidecar/RenderComponentParams.js";
import type { RenderParams } from "../generated/sidecar/RenderParams.js";
import type { RenderResult } from "../generated/sidecar/RenderResult.js";

import type { Generation } from "./bundle.js";
import { componentOutput } from "./component-output.js";
import { renderMarkup } from "./render-markup.js";
import { withRenderSession } from "./render-session.js";

export function render(
  generation: Generation,
  kind: "screen" | "component",
  params: RenderParams | RenderComponentParams,
): Promise<RenderResult> {
  return withRenderSession(generation, params.handle, params, (session) => {
    const React = generation.runtime.react;
    const context = session.context;
    const props: Record<string, unknown> = structuredClone(params.props);
    let resources: readonly string[] = [];
    const definition = generation.handles.get(params.handle);
    const data = definitionData(definition)!;
    const adapter = data.input.render as (
      props: object,
      context: object,
    ) => ReactNode;
    if ("slots" in params) {
      for (const [slot, value] of Object.entries(params.slots)) {
        const token = value.kind === "placeholder" ? value.token : "";
        function Placeholder() {
          session.placeholders.add(JSON.stringify([slot, token]));
          const enabled = React.useContext(generation.runtime.contexts.ignore);
          return React.createElement("mokly-slot", {
            name: slot,
            token,
            "ignore-scope": enabled ? "enabled" : "disabled",
          });
        }
        if (value.kind === "saved") {
          props[slot] = generation.savedSlots.get(value.handle);
        } else props[slot] = React.createElement(Placeholder);
      }
    }
    function Adapter() {
      return adapter(props, context);
    }
    let node: ReactNode = React.createElement(Adapter);
    if (kind === "component")
      node = componentOutput(generation.runtime, session, node);
    const renderer = generation.exports?.renderer?.default;
    if (generation.params.renderer) {
      if (typeof renderer !== "function")
        throw new Error("renderer default export must be a function");
      const output = (renderer as Renderer)({
        ...context,
        node,
        props: params.props,
        entry: { kind, path: params.entry.path, title: params.entry.title },
      });
      if (
        output &&
        typeof output === "object" &&
        !React.isValidElement(output) &&
        "node" in output
      ) {
        node = output.node;
        resources = output.resources ?? [];
        if (
          !Array.isArray(resources) ||
          resources.some((resource) => typeof resource !== "string")
        )
          throw new Error("renderer resources must be an array of paths");
      } else node = output as ReactNode;
    }
    const componentOwner =
      kind === "component"
        ? generation.bindings![params.handle]!.path
        : undefined;
    return renderMarkup(generation, session, node, {
      componentOwner,
      ignoreEnabled:
        !("ignoreScope" in params) || params.ignoreScope === "enabled",
      resources,
    });
  });
}
