/**
 * The stage of an HTML sample band: one frame for each view, and the wire
 * from a lit line to its element. A frame is labelled with its viewport's
 * name and icon. Its screen holds the phone's status band or the browser's
 * bar, then the view's `srcdoc` frame, which keeps its viewport width and
 * scales down, with the mark that the sample island sets over a lit element.
 * A selection with the size tag of the view's full size outlines the screen.
 * Only the first frame shows without script. The class names match the
 * mockup's drawn frames, and every part but the view's own document is a
 * depiction, hidden from assistive technology.
 */

import type { HastNode } from "satteri";

import type { IconName } from "../components/icons.js";

import { element, icon, text } from "./code-panel.js";
import type { SampleView } from "./sample-render.js";

type Element = Extract<HastNode, { type: "element" }>;

/** A viewport of a sample's views. */
export type Viewport = SampleView["viewport"];

/** The viewports in the order that the band's controls offer them. */
export const VIEWPORT_ORDER: readonly Viewport[] = ["mobile", "desktop"];

/** Each viewport's name, and the icon of its option and its frame label. */
export const VIEWPORTS: Readonly<
  Record<Viewport, { readonly icon: IconName; readonly name: string }>
> = {
  desktop: { icon: "desktop", name: "Desktop" },
  mobile: { icon: "phone", name: "Mobile" },
};

/** The properties of a depiction, which assistive technology skips. */
export const DEPICTION = { ariaHidden: "true" } as const;

/** The handles of a frame's selection, clockwise from the top-left. */
const HANDLES = ["nw", "ne", "se", "sw"] as const;

/** A part's class, and its desktop modifier for a desktop view. */
function modified(name: string, viewport: Viewport): string[] {
  return viewport === "desktop" ? [name, `${name}--desktop`] : [name];
}

/** The device chrome over a view: the phone's status band or the bar. */
function chrome(viewport: Viewport): Element {
  if (viewport === "desktop")
    return element(
      "div",
      ["site-docs-sample-browser"],
      [
        element("span", ["site-docs-sample-lights"], []),
        element("span", ["site-docs-sample-address"], []),
      ],
      DEPICTION,
    );
  const glyphs = [0, 1, 2].map(() => element("span", [], []));
  return element(
    "div",
    ["site-docs-sample-status"],
    [
      element("b", [], [text("9:41")]),
      element("span", ["site-docs-sample-glyphs"], glyphs),
    ],
    DEPICTION,
  );
}

/**
 * The view's document at its viewport width, and the mark that the sample
 * island sets over a lit element: a selection and the element's tag name.
 */
function frameView(view: SampleView): Element {
  const document = element("iframe", ["site-docs-sample-document"], [], {
    title: view.title,
    sandbox: ["allow-same-origin"],
    loading: "lazy",
    srcDoc: view.document,
  });
  const mark = element(
    "span",
    ["site-docs-sample-mark"],
    [
      element("span", ["site-sel"], [], DEPICTION),
      element("span", ["site-size-tag", "site-docs-sample-tag"], [], DEPICTION),
    ],
    { ...DEPICTION, hidden: true },
  );
  return element("div", ["site-docs-sample-view"], [document, mark]);
}

/** A frame's selection, with the size tag of the view's full size. */
function selection(view: SampleView): Element {
  const handles = HANDLES.map((at) =>
    element("span", ["site-sel-handle", `site-sel-handle--${at}`], []),
  );
  const size = element(
    "span",
    ["site-size-tag", "site-sel-size"],
    [text(`${view.width} × ${view.height}`)],
    DEPICTION,
  );
  return element("span", ["site-sel"], [...handles, size], DEPICTION);
}

/** One view's frame: its label, its screen and its selection. */
function frame(view: SampleView, hidden: boolean): Element {
  const { icon: glyph, name } = VIEWPORTS[view.viewport];
  const label = element(
    "span",
    ["site-frame-name"],
    [icon(glyph, 13), element("span", ["site-frame-name-text"], [text(name)])],
    DEPICTION,
  );
  const screen = element(
    "div",
    modified("site-docs-sample-screen", view.viewport),
    [chrome(view.viewport), frameView(view)],
  );
  return element(
    "div",
    modified("site-docs-sample-frame", view.viewport),
    [label, screen, selection(view)],
    {
      hidden,
      "data-viewport": view.viewport,
      "data-state": view.state,
      "data-state-title": view.stateTitle,
      "data-dimmed": view.dimmed.join(" "),
    },
  );
}

/** The wire from a lit line to its element, with its two ends. */
function wire(): Element {
  const drawing = element("svg", [], [element("path", [], [])], {
    fill: "none",
    focusable: "false",
    stroke: "currentColor",
    strokeWidth: "1.5",
  });
  const end = (at: string) =>
    element(
      "span",
      ["site-docs-sample-end", `site-docs-sample-end--${at}`],
      [],
    );
  return element(
    "span",
    ["site-docs-sample-wire"],
    [drawing, end("source"), end("element")],
    { ...DEPICTION, hidden: true },
  );
}

/**
 * The stage of the views, the first one shown. Search skips it, as it holds
 * only depictions and frames.
 */
export function sampleStage(views: readonly SampleView[]): Element {
  return element(
    "div",
    modified("site-docs-sample-stage", views[0]?.viewport ?? "mobile"),
    [wire(), ...views.map((view, index) => frame(view, index > 0))],
    { "data-pagefind-ignore": "" },
  );
}
