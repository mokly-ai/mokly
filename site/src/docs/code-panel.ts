/**
 * Render every code block in the Folio code panel: the language the fence
 * named, the place the copy control takes, and the highlighted block itself.
 * Authored pages and published protocol documents run through the same
 * Markdown pipeline, so both render the same panel.
 */

import type { HastPluginDefinition } from "satteri";

/** The class the documentation's copy island places a control in. */
export const COPY_SLOT = "site-code-copy-slot";

/** The class wrapping one code block. */
export const PANEL = "site-code";

interface Properties {
  readonly [key: string]: unknown;
}

function language(properties: Properties | undefined): string {
  for (const key of ["dataLanguage", "data-language"]) {
    const value = properties?.[key];
    if (typeof value === "string" && value !== "plaintext") return value;
  }
  return "";
}

function span(className: string, text: string): object {
  return {
    type: "element",
    tagName: "span",
    properties: { className: [className] },
    children: text ? [{ type: "text", value: text }] : [],
  };
}

/** The Sätteri plugin that wraps each highlighted block in the panel. */
export const codePanel: HastPluginDefinition = {
  name: "mokly-code-panel",
  element: {
    filter: ["pre"],
    visit(node, context) {
      const parent = context.parent(node);
      const classes = (parent as { properties?: Properties } | undefined)
        ?.properties?.["className"];
      if (Array.isArray(classes) && classes.includes(PANEL)) return;
      context.replaceNode(node, {
        type: "element",
        tagName: "div",
        properties: { className: [PANEL] },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: { className: ["site-code-head"] },
            children: [
              span("site-code-language", language(node.properties)),
              span(COPY_SLOT, ""),
            ],
          },
          node,
        ],
      } as never);
    },
  },
};
