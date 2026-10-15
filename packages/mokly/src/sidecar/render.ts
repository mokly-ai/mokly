import type { ReactNode } from "react";
import type * as ReactDOMServer from "react-dom/server";

import { copyData } from "../authoring/data.js";
import { definitionData } from "../authoring/runtime.js";
import type { Renderer } from "../authoring/types.js";
import type { RenderComponentParams } from "../generated/sidecar/RenderComponentParams.js";
import type { RenderParams } from "../generated/sidecar/RenderParams.js";
import type { RenderResult } from "../generated/sidecar/RenderResult.js";
import type { RenderStoryParams } from "../generated/sidecar/RenderStoryParams.js";

import type { Generation } from "./bundle.js";
import { describe } from "./describe.js";
import { SidecarError, detail } from "./errors.js";
import { finishMarkup } from "./markup.js";
import { renderSession } from "./render-session.js";
import type { PortableStory } from "./stories.js";
import { collectStyles } from "./styles.js";

export async function render(
  generation: Generation,
  kind: "screen" | "component" | "story",
  params: RenderParams | RenderComponentParams | RenderStoryParams,
): Promise<RenderResult> {
  const name = "handle" in params ? params.handle : params.storyId;
  try {
    const definitions = await describe(generation);
    if (definitions.diagnostics.length)
      throw new SidecarError(
        definitions.diagnostics[0]!.code,
        definitions.diagnostics[0]!.message,
      );
    const React = generation.runtime.react;
    const context = {
      viewport: params.viewport as "mobile" | "desktop",
      colorScheme: params.colorScheme,
    };
    const session = renderSession(generation, context);
    return generation.runtime.withSession(session, () => {
      const props = copyData(params.props) as Record<string, unknown>;
      let node: ReactNode;
      let resources: readonly string[] = [];
      if (
        kind === "story" ||
        (kind === "component" && generation.stories.has(name))
      ) {
        const stored = generation.stories.get(name) as
          { compose: () => PortableStory } | undefined;
        if (!stored) throw new Error(`unknown story ${name}`);
        const story = stored.compose();
        story.globals.moklyViewport = params.viewport;
        story.globals.moklyColorScheme = params.colorScheme;
        node = React.createElement(
          story as (props: object) => ReactNode,
          props,
        );
      } else {
        const definition = generation.handles.get(name);
        const data = definitionData(definition);
        if (!data || data.kind !== kind)
          throw new Error(`unknown ${kind} ${name}`);
        const adapter = data.input.render as (
          props: object,
          context: object,
        ) => ReactNode;
        if ("slots" in params) {
          for (const [slot, token] of Object.entries(params.slots)) {
            if (!((data.input.slots ?? []) as string[]).includes(slot))
              throw new Error(`undeclared slot ${slot}`);
            function Placeholder() {
              session.placeholders.add(JSON.stringify([slot, token]));
              const enabled = React.useContext(
                generation.runtime.contexts.ignore,
              );
              return React.createElement("mokly-slot", {
                name: slot,
                token,
                "ignore-scope": enabled ? "enabled" : "disabled",
              });
            }
            props[slot] =
              generation.savedSlots.get(token) ??
              React.createElement(Placeholder);
          }
        }
        function Adapter() {
          return adapter(props, context);
        }
        node = React.createElement(Adapter);
        const renderer = generation.exports?.renderer?.default;
        if (renderer !== undefined) {
          if (typeof renderer !== "function")
            throw new Error("renderer default export must be a function");
          const path = generation.registrations.get(definition!)?.path;
          if (!path)
            throw new Error(
              `renderer for ${name} requires its resolved catalogue path`,
            );
          const output = (renderer as Renderer)({
            ...context,
            node,
            props: params.props,
            entry: { kind, path, title: String(data.input.title) },
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
      }
      node = React.createElement(
        generation.runtime.contexts.session.Provider,
        { value: session },
        React.createElement(
          generation.runtime.contexts.owner.Provider,
          { value: { kind: "entry", seen: new Set<string>() } },
          React.createElement(
            generation.runtime.contexts.ignore.Provider,
            {
              value:
                !("ignoreScope" in params) || params.ignoreScope === "enabled",
            },
            node,
          ),
        ),
      );
      const server = generation.require(
        "react-dom/server",
      ) as typeof ReactDOMServer;
      const collected = collectStyles(
        generation,
        server.renderToStaticMarkup,
        node,
      );
      const result = finishMarkup(collected.html, session);
      return {
        html: result.html,
        styles: [...new Set([...collected.styles, ...result.styles])],
        resources: [...resources],
        warnings: generation.warnings,
      };
    });
  } catch (error) {
    if (error instanceof SidecarError) throw error;
    throw new SidecarError(
      "render-failed",
      `${name} (${params.viewport}, ${params.colorScheme}): ${detail(error)}`,
    );
  }
}
