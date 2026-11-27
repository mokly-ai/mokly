import type { ReactNode } from "react";
import type * as ReactDOMServer from "react-dom/server";

import type { RenderSession } from "../authoring/runtime.js";
import type { RenderResult } from "../generated/sidecar/RenderResult.js";

import type { Generation } from "./bundle.js";
import { componentOutput } from "./component-output.js";
import { HtmlInput } from "./html_input.js";
import { finishMarkup } from "./markup.js";
import { collectStyles } from "./styles.js";

interface MarkupOptions {
  componentOwner?: string | undefined;
  ignoreEnabled?: boolean;
  resources?: readonly string[];
  render?: (
    renderToStaticMarkup: (node: ReactNode) => string,
    node: ReactNode,
  ) => string;
}

export function renderMarkup(
  generation: Generation,
  session: RenderSession,
  node: ReactNode,
  {
    componentOwner,
    ignoreEnabled = true,
    resources = [],
    render = (renderToStaticMarkup, root) => renderToStaticMarkup(root),
  }: MarkupOptions = {},
): RenderResult {
  const React = generation.runtime.react;
  const rooted = React.createElement(
    generation.runtime.contexts.session.Provider,
    { value: session },
    React.createElement(
      generation.runtime.contexts.owner.Provider,
      { value: { kind: "entry", seen: new Set<string>() } },
      React.createElement(
        generation.runtime.contexts.ignore.Provider,
        { value: ignoreEnabled },
        node,
      ),
    ),
  );
  const server = generation.require(
    "react-dom/server",
  ) as typeof ReactDOMServer;
  const collected = collectStyles(
    generation,
    (root) => render(server.renderToStaticMarkup, root),
    rooted,
    componentOwner,
  );
  if (componentOwner !== undefined && !session.componentOutput)
    collected.input = new HtmlInput(
      server.renderToStaticMarkup(
        componentOutput(generation.runtime, session, null),
      ) + collected.input.html,
    );
  const result = finishMarkup(
    collected.input,
    session,
    true,
    collected.inlineAttribution,
  );
  const owners = componentOwner === undefined ? [] : [componentOwner];
  const styles = [...collected.styles, ...result.styles].map((style) => ({
    ...style,
    owners: style.owners.length ? style.owners : owners,
  }));
  return {
    html: result.html,
    styles: styles.filter(
      (style, index, all) =>
        all.findIndex(
          (other) =>
            other.css === style.css &&
            JSON.stringify(other.owners) === JSON.stringify(style.owners),
        ) === index,
    ),
    markers: result.markers,
    resources: [...resources],
    instances: session.instances,
    slots: session.slots,
  };
}
