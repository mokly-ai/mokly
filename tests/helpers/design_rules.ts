import path from "node:path";

import type { DefaultTreeAdapterMap } from "parse5";

import { ADOPTION, requiredComponents } from "./design_expectations.js";
import { attribute, type HtmlElement } from "./html.js";
import {
  viewRoute,
  type ServedCatalogue,
  type ServedView,
} from "./served_design.js";

type HtmlNode = DefaultTreeAdapterMap["node"];

/** Every element below a node, with its element ancestors nearest first. */
export function* withAncestors(
  node: HtmlNode,
  ancestors: readonly HtmlElement[] = [],
): Generator<[HtmlElement, readonly HtmlElement[]]> {
  const own = "tagName" in node ? [node, ...ancestors] : ancestors;
  if ("tagName" in node) yield [node, ancestors];
  if ("childNodes" in node)
    for (const child of node.childNodes) yield* withAncestors(child, own);
}

/**
 * Whether the shipped stylesheet lets a catalogue row's changed wording reach
 * assistive technology: on a changed row that was not removed, and on a row
 * whose variants changed. Every other row hides the wording.
 */
function speaksChanged(row: HtmlElement): boolean {
  return (
    (attribute(row, "data-changed") === "true" &&
      attribute(row, "data-nav-removed") === undefined) ||
    attribute(row, "data-changed-variants") === "true"
  );
}

/** Text that a reader hears, without a row's hidden changed wording. */
function spokenText(node: HtmlNode, hideChanged: boolean): string {
  if ("value" in node) return node.value;
  if (
    hideChanged &&
    "tagName" in node &&
    attribute(node, "data-nav-changed-text") !== undefined
  )
    return "";
  return "childNodes" in node
    ? node.childNodes.map((child) => spokenText(child, hideChanged)).join("")
    : "";
}

/** A link's accessible name: its `aria-label`, or else its collapsed text. */
export function accessibleName(element: HtmlElement): string {
  const hideChanged =
    attribute(element, "data-nav-row") !== undefined && !speaksChanged(element);
  return (
    attribute(element, "aria-label") ??
    spokenText(element, hideChanged).trim().replace(/\s+/gu, " ")
  );
}

/** Whether the element or an ancestor carries `hidden`, so no reader reaches it. */
export function isHidden(
  element: HtmlElement,
  ancestors: readonly HtmlElement[],
): boolean {
  return [element, ...ancestors].some(
    (node) => attribute(node, "hidden") !== undefined,
  );
}

/** Whether sequential keyboard navigation stops at the element. */
function focusStop(element: HtmlElement): boolean {
  const tabindex = attribute(element, "tabindex");
  if (tabindex === "-1" || attribute(element, "disabled") !== undefined)
    return false;
  if (element.tagName === "a") return attribute(element, "href") !== undefined;
  return (
    ["button", "input", "select", "textarea", "summary"].includes(
      element.tagName,
    ) || tabindex !== undefined
  );
}

const designViews = (catalogue: ServedCatalogue) =>
  catalogue.views.filter((view) => view.path.startsWith("design/"));

const label = (view: ServedView) => view.route;

/**
 * Catalogue-wide link validation: every marked link opens an existing entry,
 * a design entry from a design view, through a portable relative href for
 * the same viewport, with the dark file wherever the target renders one; no
 * link nests in or holds another focus stop; no inactive control is a link;
 * only an anchor carries a link marker; and a design link to its own entry
 * says that it is the current page, apart from the top bar's brand link.
 */
export function linkViolations(catalogue: ServedCatalogue): string[] {
  const visual = new Map(
    [...catalogue.index.screens, ...catalogue.index.components].map((entry) => [
      entry.path,
      entry,
    ]),
  );
  const other = new Set(
    [
      ...catalogue.index.pages,
      ...catalogue.index.documents,
      ...catalogue.index.useCases,
    ].map((entry) => entry.path),
  );
  const violations: string[] = [];
  for (const view of catalogue.views)
    for (const [element, ancestors] of withAncestors(view.document)) {
      if (element.tagName !== "a") {
        if (attribute(element, "data-mokly-link") !== undefined)
          violations.push(`${label(view)}: a ${element.tagName} link marker`);
        continue;
      }
      const target = attribute(element, "data-mokly-link");
      const href = attribute(element, "href");
      const where = `${label(view)}: "${accessibleName(element)}"`;
      if (target === undefined) {
        if (href !== undefined && !/^(#|https?:|mailto:)/u.test(href))
          violations.push(`${where} has an unmarked href ${href}`);
        continue;
      }
      const [entryPath = "", fragment] = target.split("#");
      const entry = visual.get(entryPath);
      if (!entry && !other.has(entryPath))
        violations.push(`${where} opens ${target}, which is no entry`);
      // Design links name design entries, not the depicted example paths.
      if (view.path.startsWith("design/") && !entryPath.startsWith("design/"))
        violations.push(`${where} opens the example entry ${target}`);
      if (entry) {
        const scheme =
          view.colorScheme === "dark" && entry.colorSchemes.includes("dark")
            ? "dark"
            : "light";
        const route = viewRoute(entryPath, view.viewport, scheme);
        const expected =
          path.posix.relative(path.posix.dirname(view.route), route) +
          (fragment === undefined ? "" : `#${fragment}`);
        if (href !== expected)
          violations.push(`${where} has href ${href}, not ${expected}`);
      }
      if (ancestors.some(focusStop))
        violations.push(`${where} sits inside another focus stop`);
      for (const [inner] of withAncestors(element))
        if (inner !== element && focusStop(inner))
          violations.push(`${where} holds a ${inner.tagName} focus stop`);
      if (attribute(element, "aria-disabled") === "true")
        violations.push(`${where} is an inactive control`);
      if (
        entryPath === view.path &&
        view.path.startsWith("design/") &&
        attribute(element, "aria-current") === undefined &&
        attribute(element, "class") !== "mbk-brand"
      )
        violations.push(`${where} links to its own entry without aria-current`);
    }
  return violations;
}

/**
 * Keyboard stops that open nothing: on design screens outside the component
 * explorer designs, which depict its interactive controls, only the depicted
 * variant disclosure is an enabled button, and only a link takes a tab stop.
 */
export function keyboardStopViolations(catalogue: ServedCatalogue): string[] {
  const violations: string[] = [];
  for (const view of designViews(catalogue)) {
    if (view.kind !== "screen" || view.path.startsWith("design/components/"))
      continue;
    for (const [element] of withAncestors(view.document)) {
      const tabindex = attribute(element, "tabindex");
      if (
        element.tagName === "button" &&
        attribute(element, "disabled") === undefined &&
        attribute(element, "class") !== "mbk-nav-variants-toggle"
      )
        violations.push(`${label(view)}: button "${accessibleName(element)}"`);
      else if (
        element.tagName !== "a" &&
        tabindex !== undefined &&
        tabindex !== "-1"
      )
        violations.push(`${label(view)}: ${element.tagName} tabindex`);
    }
  }
  return violations;
}

/** Scripts, inline handlers, and script URLs in any served view document. */
export function scriptViolations(catalogue: ServedCatalogue): string[] {
  const violations: string[] = [];
  for (const view of catalogue.views)
    for (const [element] of withAncestors(view.document)) {
      if (element.tagName === "script")
        violations.push(`${label(view)}: script element`);
      for (const { name, value } of element.attrs)
        if (/^on/iu.test(name) || /^\s*javascript:/iu.test(value))
          violations.push(`${label(view)}: ${element.tagName} ${name}`);
    }
  return violations;
}

/** Recorded usage of each design screen view against its family's shared components. */
export function adoptionViolations(catalogue: ServedCatalogue): string[] {
  const screens = new Set(catalogue.index.screens.map((entry) => entry.path));
  const violations = ADOPTION.parts.flatMap((part) =>
    [...(part.except ?? []), ...(part.only ?? [])]
      .filter((path) => !screens.has(path))
      .map((path) => `${part.component} lists ${path}, which is no screen`),
  );
  for (const entry of catalogue.index.screens) {
    if (!entry.path.startsWith("design/")) continue;
    for (const view of catalogue.details.get(entry.path)!.views) {
      const where = viewRoute(entry.path, view.viewport, view.colorScheme);
      if (view.usage.status !== "ready") {
        violations.push(`${where}: usage is ${view.usage.status}`);
        continue;
      }
      const ids = new Set(view.usage.instances.map((use) => use.componentId));
      for (const id of requiredComponents(entry.path, view.viewport))
        if (!ids.has(id)) violations.push(`${where}: no ${id}`);
      const keys = new Set(view.usage.instances.map((use) => use.key));
      if (keys.size !== view.usage.instances.length)
        violations.push(`${where}: repeated instance keys`);
    }
  }
  return violations;
}

const BASE_SHEETS = new Set([
  "design.css",
  "design-stage.css",
  "design-documents.css",
  "design-review.css",
  "design-review-scroll.css",
]);

/** A design view's stylesheet links, relative to the example directory. */
export function stylesheets(view: ServedView): string[] {
  return [...withAncestors(view.document)].flatMap(([element]) =>
    element.tagName === "link" && attribute(element, "rel") === "stylesheet"
      ? [
          attribute(element, "href")!.replace(
            /^(\.\.\/)*styles\/examples\/basic\//u,
            "",
          ),
        ]
      : [],
  );
}

/**
 * Each design view links exactly the own stylesheets of the library
 * components it renders, as one block between the base and layout sheets.
 */
export function componentSheetViolations(catalogue: ServedCatalogue): string[] {
  const violations: string[] = [];
  for (const view of designViews(catalogue)) {
    const usage = catalogue.details
      .get(view.path)!
      .views.find(
        (candidate) =>
          candidate.viewport === view.viewport &&
          candidate.colorScheme === view.colorScheme,
      )!.usage;
    const ids = new Set(
      usage.status === "ready"
        ? usage.instances.map((use) => use.componentId)
        : [],
    );
    if (view.kind === "component")
      ids.add(view.path.split("/").slice(0, 4).join("/"));
    const expected = [...ids]
      .filter((id) => id.startsWith("design/library/"))
      .map((id) => `design-library/${id.slice("design/library/".length)}.css`)
      .sort();
    const links = stylesheets(view);
    const own = links.filter((sheet) => sheet.startsWith("design-library/"));
    if ([...own].sort().join() !== expected.join())
      violations.push(
        `${label(view)}: links ${[...own].sort().join(", ")}; renders ${expected.join(", ")}`,
      );
    const first = links.findIndex((sheet) =>
      sheet.startsWith("design-library/"),
    );
    const last = links.findLastIndex((sheet) =>
      sheet.startsWith("design-library/"),
    );
    const between = links.slice(first, last + 1);
    if (
      first >= 0 &&
      (between.length !== own.length ||
        links.slice(last + 1).some((sheet) => BASE_SHEETS.has(sheet)) ||
        links.slice(0, first).some((sheet) => !BASE_SHEETS.has(sheet)))
    )
      violations.push(`${label(view)}: component sheets out of place`);
  }
  return violations;
}
