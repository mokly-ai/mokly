import { withAncestors } from "./design_accessibility.js";
import { canvasScopeTokens } from "./design_palette.js";
import { attribute, textContent, type HtmlElement } from "./html.js";
import type { ServedCatalogue, ServedView } from "./served_design.js";

// Each Canvas mockup view is the document of one scheme, so the shell's
// canvas frames keep each frame in its own scheme whatever the preview
// Appearance. The view's Canvas root names and paints the scheme that its
// file was rendered for, and its one Appearance selector shows that scheme.
// A light-only inner screen draws no dark preview, and each Frames filter
// disables Dark and names the fallback.

/** The Canvas designs of the shell design inventory. */
const CANVAS = "design/canvas/";

/** The startup states, which the shell draws before any Appearance control. */
const STARTUP = [
  "design/canvas/loading/catalogue",
  "design/canvas/loading/catalogue/failed",
  "design/canvas/loading/catalogue/version",
];

/** The design whose inner screen has no dark view. */
const LIGHT_ONLY = "design/canvas/inspect/unchanged";

function hasClass(element: HtmlElement, name: string): boolean {
  return (attribute(element, "class") ?? "").split(/\s+/u).includes(name);
}

/** The custom properties of an inline `style` attribute. */
function inlineProperties(element: HtmlElement): Map<string, string> {
  const properties = new Map<string, string>();
  for (const declaration of (attribute(element, "style") ?? "").split(";")) {
    const colon = declaration.indexOf(":");
    if (colon > 0)
      properties.set(
        declaration.slice(0, colon).trim(),
        declaration.slice(colon + 1).trim(),
      );
  }
  return properties;
}

/** Each fact of one view's Canvas root and selector that breaks the rule. */
function viewViolations(view: ServedView): string[] {
  const scheme = view.colorScheme;
  const all = [...withAncestors(view.document)].map(([element]) => element);
  const roots = all.filter((element) => hasClass(element, "cv-root"));
  if (roots.length !== 1) return [`${roots.length} Canvas roots`];
  const root = roots[0]!;
  const violations: string[] = [];
  for (const name of ["data-mbk-appearance", "data-mokly-theme"]) {
    const value = attribute(root, name);
    if (value !== scheme) violations.push(`${name} ${value}`);
  }
  const background = inlineProperties(root).get("--cv-background");
  const expected = canvasScopeTokens(scheme).get("--cv-background");
  if (background !== expected)
    violations.push(`--cv-background ${background}, not ${expected}`);
  const selectors = all.filter((element) =>
    hasClass(element, "mbk-appearance"),
  );
  const values = selectors.map((element) =>
    attribute(element, "data-appearance-value"),
  );
  const wanted = STARTUP.includes(view.path) ? [] : [scheme];
  if (JSON.stringify(values) !== JSON.stringify(wanted))
    violations.push(`Appearance selectors ${JSON.stringify(values)}`);
  return violations;
}

/** The name of a checkbox: its `aria-label`, or the text of its label. */
function checkboxName(
  element: HtmlElement,
  ancestors: readonly HtmlElement[],
): string {
  const label = ancestors.find((ancestor) => ancestor.tagName === "label");
  return (
    attribute(element, "aria-label") ??
    (label ? textContent(label) : "").replace(/\s+/gu, " ").trim()
  );
}

/** The light-only design's dark previews and the Dark boxes of its filters. */
function lightOnlyViolations(view: ServedView): string[] {
  const elements = [...withAncestors(view.document)];
  const violations: string[] = [];
  if (
    elements.some(
      ([element]) => attribute(element, "data-preview-color-scheme") === "dark",
    )
  )
    violations.push("draws a dark preview");
  const boxes = elements.filter(
    ([element, ancestors]) =>
      element.tagName === "input" &&
      attribute(element, "type") === "checkbox" &&
      /^Dark/u.test(checkboxName(element, ancestors)) &&
      ancestors.some(
        (ancestor) =>
          attribute(ancestor, "role") === "group" &&
          attribute(ancestor, "aria-label") === "Frames",
      ),
  );
  if (boxes.length !== 1) violations.push(`${boxes.length} Dark boxes`);
  for (const [box, ancestors] of boxes) {
    if (attribute(box, "disabled") === undefined)
      violations.push("Dark is enabled");
    if (!/light only/iu.test(checkboxName(box, ancestors)))
      violations.push(`Dark is named "${checkboxName(box, ancestors)}"`);
  }
  return violations;
}

/**
 * Each Canvas view that does not name and paint the scheme it was rendered
 * for, and each view of the light-only design that offers Dark.
 */
export function appearanceViolations(catalogue: ServedCatalogue): string[] {
  const views = catalogue.views.filter(
    (view) => view.kind === "screen" && view.path.startsWith(CANVAS),
  );
  const violations = views.flatMap((view) =>
    viewViolations(view).map((violation) => `${view.route}: ${violation}`),
  );
  const lightOnly = views.filter((view) => view.path === LIGHT_ONLY);
  if (lightOnly.length !== 4)
    violations.push(`${LIGHT_ONLY}: ${lightOnly.length} views, not 4`);
  for (const view of lightOnly)
    violations.push(
      ...lightOnlyViolations(view).map(
        (violation) => `${view.route}: ${violation}`,
      ),
    );
  return violations;
}
