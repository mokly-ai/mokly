import path from "node:path";

import type { HastNode } from "satteri";

import { COPY_SLOT, PANEL } from "./code-panel.js";
import type { RenderedSample } from "./sample-render.js";

type Element = Extract<HastNode, { type: "element" }>;

function element(
  tagName: string,
  className: string,
  children: Element["children"],
  properties: Element["properties"] = {},
): Element {
  return {
    type: "element",
    tagName,
    properties: { className: className.split(" "), ...properties },
    children,
  };
}

function span(className: string, value: string): Element {
  return element("span", className, [{ type: "text", value }]);
}

function classes(node: Element): string[] {
  const value = node.properties.className ?? node.properties["class"];
  return Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? value.split(/\s+/u)
      : [];
}

function withClasses(node: Element, extra: string[]): Element["properties"] {
  const properties = { ...node.properties };
  delete properties["class"];
  properties.className = [...classes(node), ...extra];
  return properties;
}

function numberedPre(pre: Element, sample: RenderedSample): Element {
  const code = pre.children.find(
    (child) => child.type === "element" && child.tagName === "code",
  );
  if (code?.type !== "element")
    throw new Error("The highlighted sample has no code element.");
  const dimmed = sample.views[0]?.dimmed ?? [];
  const numbered = (line: Element, index: number): Element => {
    const marker = sample.lines[index];
    return {
      ...line,
      properties: {
        ...withClasses(line, [
          "site-code-line",
          ...(dimmed.includes(index + 1) ? ["site-code-line--dim"] : []),
        ]),
        "data-line": index + 1,
        ...(marker === null || marker === undefined
          ? {}
          : { "data-sample-line": marker }),
      },
    };
  };
  let index = 0;
  const children = code.children.map((child) =>
    child.type === "element" && classes(child).includes("line")
      ? numbered(child, index++)
      : child,
  );
  const properties = withClasses(pre, ["site-code-body"]);
  delete properties["data-sample-meta"];
  return {
    ...pre,
    properties,
    children: [
      {
        ...code,
        children,
      },
    ],
  };
}

/** Plain sample markup around the highlighted fence and its rendered views. */
export function sampleBand(
  pre: Element,
  file: string,
  sample: RenderedSample,
): Element {
  return element("div", "site-docs-sample", [
    element(
      "div",
      "site-docs-sample-head",
      [
        span("site-docs-sample-name", sample.title),
        span("site-chip site-chip--neutral site-chip--mono", sample.path),
      ],
      { ariaHidden: "true" },
    ),
    element("div", `${PANEL} site-code--numbered site-docs-sample-code`, [
      element("div", "site-code-head", [
        span("site-code-tab site-code-tab--open", path.posix.basename(file)),
        span("site-code-meta", path.posix.dirname(file)),
        span("site-code-language site-code-language--end", "html"),
        span(COPY_SLOT, ""),
      ]),
      numberedPre(pre, sample),
    ]),
    element(
      "div",
      "site-docs-sample-stage",
      sample.views.map((view, index) =>
        element(
          "div",
          "site-docs-sample-frame",
          [
            element("iframe", "site-docs-sample-screen", [], {
              title: view.title,
              sandbox: ["allow-same-origin"],
              width: view.width,
              height: view.height,
              loading: "lazy",
              srcDoc: view.document,
            }),
          ],
          {
            hidden: index > 0,
            "data-viewport": view.viewport,
            "data-state": view.state,
            "data-state-title": view.stateTitle,
            "data-dimmed": view.dimmed.join(" "),
          },
        ),
      ),
    ),
  ]);
}
