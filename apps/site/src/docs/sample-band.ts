/**
 * The HTML sample band: a band of the dot-grid canvas across the page sheet
 * that sets a guide's HTML sample beside the views it renders. The head names
 * the screen as a dark tag and its catalogue path as a chip. The fence sits in
 * a numbered code panel whose open tab names the file in its folder. The
 * controls choose the viewport and the saved state, and `sample-stage.ts`
 * draws the frames of the views and the wire.
 *
 * Only the first view shows, with its dimmed lines. The sample island,
 * `src/components/docs/sample-island.ts`, shows the controls, switches the
 * views and draws the lit line's mark and wire. The class names match the
 * mockup's sample band.
 */

import path from "node:path";

import type { HastNode } from "satteri";

import {
  COPY_SLOT,
  PANEL,
  element,
  icon,
  isLine,
  language,
  lines,
  tabIcon,
  text,
  withClass,
} from "./code-panel.js";
import type { RenderedSample, SampleView } from "./sample-render.js";
import {
  DEPICTION,
  VIEWPORT_ORDER,
  VIEWPORTS,
  sampleStage,
} from "./sample-stage.js";

type Element = Extract<HastNode, { type: "element" }>;
type Child = Element["children"][number];

/**
 * The fence's highlighted block as the panel's body: Shiki's lines, each
 * holding its newline, numbered and mapped to the element that it renders,
 * with the lines that the first view leaves out dimmed.
 */
function numberedPre(pre: Element, sample: RenderedSample): Element {
  const code = pre.children.find(
    (child) => child.type === "element" && child.tagName === "code",
  );
  if (code?.type !== "element")
    throw new Error("The highlighted sample has no code element.");
  const dimmed = new Set(sample.views[0]?.dimmed);
  let number = 0;
  const numbered = (line: Element): Element => {
    number += 1;
    const marker = sample.lines[number - 1];
    const shown = dimmed.has(number)
      ? withClass(line, "site-code-line--dim")
      : line;
    return {
      ...shown,
      properties: {
        ...shown.properties,
        "data-line": number,
        ...(marker === null || marker === undefined
          ? {}
          : { "data-sample-line": marker }),
      },
    };
  };
  const body = withClass(pre, "site-code-body");
  delete body.properties["data-sample-meta"];
  const children = lines(code.children).map((child) =>
    isLine(child) ? numbered(child) : child,
  );
  return { ...body, children: [{ ...code, children }] };
}

/**
 * The numbered code panel, whose open tab names the file in its folder. The
 * file's name sits in a part of its own, which shrinks and ends in an
 * ellipsis where the bar cannot hold it, and keeps the whole name as text.
 */
function codePanel(
  pre: Element,
  file: string,
  sample: RenderedSample,
): Element {
  const name = language(pre);
  const head = element(
    "div",
    ["site-code-head"],
    [
      element(
        "span",
        ["site-code-tab", "site-code-tab--open"],
        [
          tabIcon(name),
          element(
            "span",
            ["site-code-tab-name"],
            [text(path.posix.basename(file))],
          ),
        ],
      ),
      element("span", ["site-code-meta"], [text(path.posix.dirname(file))]),
      element(
        "span",
        ["site-code-language", "site-code-language--end"],
        [text(name)],
      ),
      element("span", [COPY_SLOT], []),
    ],
  );
  return element(
    "div",
    [PANEL, "site-code--numbered", "site-docs-sample-code"],
    [head, numberedPre(pre, sample)],
  );
}

/** One native radio of a control, drawn as a segment of its track. */
function option(
  name: "state" | "viewport",
  value: string,
  checked: boolean,
  label: readonly Child[],
): Element {
  const input = element(
    "input",
    ["site-visually-hidden", "site-docs-sample-input"],
    [],
    { checked, name, type: "radio", value },
  );
  return element("label", ["site-docs-sample-option"], [input, ...label]);
}

/**
 * The two segmented controls: the viewports, each an icon that names itself
 * with hidden text, and the saved states by title, the default state first.
 * They check the first view, and only the sample island shows them. The
 * band's own form keeps its radios in groups apart from another band's.
 */
function controls(views: readonly SampleView[]): Element {
  const [first] = views;
  const viewports = VIEWPORT_ORDER.filter((viewport) =>
    views.some((view) => view.viewport === viewport),
  );
  const states = views.filter(
    (view, index) =>
      views.findIndex((other) => other.state === view.state) === index,
  );
  const viewport = element(
    "fieldset",
    ["site-docs-sample-control"],
    viewports.map((value) =>
      option("viewport", value, value === first?.viewport, [
        icon(VIEWPORTS[value].icon, 15),
        element(
          "span",
          ["site-visually-hidden"],
          [text(VIEWPORTS[value].name)],
        ),
      ]),
    ),
    { ariaLabel: "Viewport" },
  );
  const state = element(
    "fieldset",
    ["site-docs-sample-control"],
    states.map((view) =>
      option("state", view.state, view.state === first?.state, [
        text(view.stateTitle),
      ]),
    ),
    { ariaLabel: "Saved state" },
  );
  return element("form", ["site-docs-sample-controls"], [viewport, state], {
    "data-pagefind-ignore": "",
  });
}

/** The sample band around the highlighted fence and its rendered views. */
export function sampleBand(
  pre: Element,
  file: string,
  sample: RenderedSample,
): Element {
  const head = element(
    "div",
    ["site-docs-sample-head"],
    [
      element("span", ["site-docs-sample-name"], [text(sample.title)]),
      element(
        "span",
        ["site-chip", "site-chip--neutral", "site-chip--mono"],
        [text(sample.path)],
      ),
    ],
    DEPICTION,
  );
  return element(
    "div",
    ["site-docs-sample"],
    [
      head,
      codePanel(pre, file, sample),
      controls(sample.views),
      sampleStage(sample.views),
    ],
  );
}
