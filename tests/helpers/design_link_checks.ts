import { links, tagStates } from "./design_expectations.js";
import { accessibleName, withAncestors } from "./design_rules.js";
import { attribute, textContent, type HtmlElement } from "./html.js";
import type { ServedCatalogue, ServedView } from "./served_design.js";

const VIEWPORTS = ["mobile", "desktop"] as const;

const classes = (element: HtmlElement) =>
  (attribute(element, "class") ?? "").split(/\s+/u);

const named = (
  view: ServedView,
  matches: (name: string) => boolean,
  within: string | undefined,
) =>
  [...withAncestors(view.document)]
    .filter(
      ([element, ancestors]) =>
        element.tagName === "a" &&
        (within === undefined ||
          ancestors.some((node) => classes(node).includes(within))),
    )
    .map(([element]) => element)
    .filter((element) => matches(accessibleName(element)));

/** The semantic destinations of each control family, in every listed view. */
export function expectationViolations(catalogue: ServedCatalogue): string[] {
  const violations: string[] = [];
  for (const expectation of links) {
    const pattern = new RegExp(expectation.namePattern ?? "^$", "u");
    const matches = (name: string) =>
      expectation.name === undefined
        ? pattern.test(name)
        : name === expectation.name;
    const views = catalogue.views.filter(
      (view) =>
        view.path === expectation.source &&
        (expectation.viewports ?? VIEWPORTS).includes(view.viewport),
    );
    if (views.length === 0) violations.push(`${expectation.source}: no view`);
    for (const view of views) {
      const found = named(view, matches, expectation.within);
      const name = expectation.name ?? expectation.namePattern;
      const targets = found.map((link) => attribute(link, "data-mokly-link"));
      const wrong =
        expectation.target === null
          ? found.length > 0
          : found.length === 0 ||
            targets.some((target) => target !== expectation.target);
      if (wrong)
        violations.push(`${view.route}: "${name}" -> ${targets.join(", ")}`);
    }
  }
  return violations;
}

const byClass = (view: ServedView, name: string): HtmlElement[] =>
  [...withAncestors(view.document)]
    .map(([element]) => element)
    .filter((element) => classes(element).includes(name));

/**
 * The Welcome tag states agree: the query, the picker, the active chips,
 * the search field's tag control, every chip's destination, and the rows a
 * filtered desktop view keeps.
 */
export function tagViolations(catalogue: ServedCatalogue): string[] {
  const violations: string[] = [];
  for (const state of tagStates)
    for (const view of catalogue.views.filter(
      (view) => view.path === state.path,
    )) {
      const facts = (label: string, actual: unknown, expected: unknown) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected))
          violations.push(`${view.route}: ${label} ${JSON.stringify(actual)}`);
      };
      facts(
        "query",
        byClass(view, "mbk-search-value")
          .map((node) => textContent(node))
          .join(""),
        state.query,
      );
      facts("picker", byClass(view, "mbk-tag-picker").length > 0, state.picker);
      facts(
        "toggle",
        byClass(view, "mbk-search-tag").map((node) =>
          attribute(node, "data-mokly-link"),
        ),
        [state.toggle],
      );
      const chips = byClass(view, "mbk-chip").filter((node) =>
        classes(node).includes("tag"),
      );
      for (const chip of chips) {
        const tag = textContent(chip).trim();
        const active = classes(chip).includes("active");
        facts(`chip ${tag} active`, active, state.active.includes(tag));
        const target = active
          ? "design/browse/views/screen"
          : `design/browse/views/screen/tag-${tag}`;
        facts(`chip ${tag} target`, attribute(chip, "data-mokly-link"), target);
      }
      if (chips.length === 0) violations.push(`${view.route}: no tag chips`);
      if (state.rows && view.viewport === "desktop")
        facts(
          "rows",
          byClass(view, "mbk-nav-row")
            .filter((node) => node.tagName === "a")
            .map((node) => accessibleName(node)),
          state.rows,
        );
    }
  return violations;
}
