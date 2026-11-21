/**
 * Render every code block in the Canvas code panel: a head whose open tab
 * shows an icon and names the fence's language, the marker after which the
 * copy control takes its place, and the highlighted block, one line element
 * per line. A `bash`, `sh` or `shell` block takes the prompt modifier, so the
 * stylesheet draws the `$` and the code's text stays exactly what Copy
 * copies. Authored pages and published protocol documents render the panel
 * through the Markdown plugin, and the install snippet through the Shiki
 * transformer, so every page draws the same panel.
 */

import type { SatteriMarkdownProcessorOptions } from "@astrojs/markdown-satteri";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import type { HastNode, HastPluginDefinition } from "satteri";

import { ICONS, VIEW_BOXES, type IconName } from "../components/icons.js";

type Element = Extract<HastNode, { type: "element" }>;

type Transformer = NonNullable<
  NonNullable<SatteriMarkdownProcessorOptions["shikiConfig"]>["transformers"]
>[number];

/** The class of the marker after which the copy island places a control. */
export const COPY_SLOT = "site-code-copy-slot";

/** The class wrapping one code block. */
export const PANEL = "site-code";

/** The fence languages whose lines the panel draws after a `$` prompt. */
const PROMPTED: ReadonlySet<string> = new Set(["bash", "sh", "shell"]);

/**
 * The fence languages whose tab takes the terminal icon, the rule of
 * `CodePanel.astro`.
 */
const TERMINALS: ReadonlySet<string> = new Set([
  "bash",
  "console",
  "sh",
  "shell",
]);

function classes(node: Readonly<Element>): string[] {
  const value = node.properties["className"] ?? node.properties["class"];
  return Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? value.split(/\s+/u).filter(Boolean)
      : [];
}

function withClass(node: Readonly<Element>, name: string): Element {
  const properties = { ...node.properties };
  delete properties["class"];
  properties["className"] = [...classes(node), name];
  return { ...node, properties };
}

function element(
  tagName: string,
  className: readonly string[],
  children: Element["children"],
): Element {
  return {
    type: "element",
    tagName,
    properties: { className: [...className] },
    children,
  };
}

/** One shape of an icon drawing, with its own shapes, as hast. */
function shape(node: DefaultTreeAdapterMap["element"]): Element {
  return {
    type: "element",
    tagName: node.tagName,
    properties: Object.fromEntries(
      node.attrs.map(({ name, value }) => [name, value]),
    ),
    children: node.childNodes.flatMap((child) =>
      "tagName" in child ? [shape(child)] : [],
    ),
  };
}

/**
 * One icon of the site's set, `size` pixels square, with the attributes that
 * `Icon.astro` gives it. Both pipelines serialize hast, so the drawing from
 * `icons.ts` becomes elements rather than raw HTML, which Shiki would escape.
 */
function icon(name: IconName, size: number): Element {
  const [svg] = parseFragment(`<svg>${ICONS[name]}</svg>`).childNodes;
  return {
    type: "element",
    tagName: "svg",
    properties: {
      ariaHidden: "true",
      fill: "none",
      focusable: "false",
      height: size,
      stroke: "currentColor",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeWidth: "1.5",
      viewBox: VIEW_BOXES[name] ?? "0 0 16 16",
      width: size,
    },
    children: svg && "tagName" in svg ? shape(svg).children : [],
  };
}

function language(pre: Readonly<Element>): string {
  for (const key of ["dataLanguage", "data-language"]) {
    const value = pre.properties[key];
    if (typeof value === "string" && value !== "plaintext") return value;
  }
  return "";
}

function isLine(node: Element["children"][number]): node is Element {
  return (
    node.type === "element" &&
    node.tagName === "span" &&
    classes(node).includes("line")
  );
}

/**
 * Shiki's lines, each marked as a panel line and holding the newline that
 * follows it. No text then sits between two lines, which the stylesheet draws
 * as blocks, and the block's text stays its source, newlines included.
 */
function lines(children: Element["children"]): Element["children"] {
  const result: Element["children"] = [];
  for (const child of children) {
    const previous = result.at(-1);
    if (
      child.type === "text" &&
      child.value === "\n" &&
      previous !== undefined &&
      isLine(previous)
    ) {
      result[result.length - 1] = {
        ...previous,
        children: [...previous.children, child],
      };
      continue;
    }
    result.push(isLine(child) ? withClass(child, "site-code-line") : child);
  }
  return result;
}

function body(pre: Readonly<Element>): Element {
  return {
    ...withClass(pre, "site-code-body"),
    children: pre.children.map((child) =>
      child.type === "element" && child.tagName === "code"
        ? { ...child, children: lines(child.children) }
        : child,
    ),
  };
}

/** One highlighted block in its panel. */
function panel(pre: Readonly<Element>): Element {
  const name = language(pre);
  return element(
    "div",
    PROMPTED.has(name) ? [PANEL, "site-code--prompt"] : [PANEL],
    [
      element(
        "div",
        ["site-code-head"],
        [
          element(
            "span",
            ["site-code-tab", "site-code-tab--open", "site-code-language"],
            [
              icon(TERMINALS.has(name) ? "terminal" : "file", 13),
              ...(name ? [{ type: "text" as const, value: name }] : []),
            ],
          ),
          element("span", [COPY_SLOT], []),
        ],
      ),
      body(pre),
    ],
  );
}

/** The Sätteri plugin that renders each highlighted Markdown block. */
export const codePanel: HastPluginDefinition = {
  name: "mokly-code-panel",
  element: {
    filter: ["pre"],
    visit(node, context) {
      // A block already in a panel, such as the sample band's, keeps it.
      const parent = context.parent(node);
      if (parent?.type === "element" && classes(parent).includes(PANEL)) return;
      return panel(node);
    },
  },
};

/** The Shiki transformer that renders an Astro `Code` block in the panel. */
export const codePanelTransformer: Transformer = {
  name: "mokly-code-panel",
  root(root) {
    return {
      ...root,
      children: root.children.map((child) =>
        child.type === "element" && child.tagName === "pre"
          ? panel(child)
          : child,
      ),
    };
  },
};
