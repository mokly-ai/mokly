import assert from "node:assert/strict";

import { serializeOuter } from "parse5";

import {
  attribute,
  byClass,
  elements,
  textContent,
  type Element,
} from "./design_catalogue.js";

type Node = Parameters<typeof byClass>[0];

/** A row's own label, without its count or the changed mark's hidden text. */
export function rowLabel(row: Element): string {
  const own = byClass(row, "mbk-nav-label")[0];
  return own
    ? textContent(own).trim()
    : textContent(row)
        .replace(/Changed$/, "")
        .trim();
}

export function rowLabels(node: Node): string[] {
  return byClass(node, "mbk-nav-row").map(rowLabel);
}

/** The head band's title, which is the depicted entry's own title. */
export function headTitle(node: Node): string {
  const row = byClass(node, "mbk-title-row")[0];
  assert.ok(row);
  return textContent(
    elements(row, (element) => element.tagName === "h2")[0]!,
  ).trim();
}

/** Breadcrumb labels with their destinations, ignoring the separators. */
export function headCrumbs(node: Node): (string | undefined)[][] {
  const nav = byClass(node, "mbk-crumbs")[0];
  assert.ok(nav);
  return elements(
    nav,
    (element) =>
      (element.tagName === "a" || element.tagName === "span") &&
      attribute(element, "class") !== "sep",
  ).map((crumb) => [
    textContent(crumb).trim(),
    attribute(crumb, "data-mokly-link"),
  ]);
}

/** A leaf row's icon: its wrapper class and the SVG markup the wrapper holds. */
export function rowIcon(node: Node, label: string): [string, string] {
  const row = byClass(node, "mbk-nav-row").find(
    (candidate) => rowLabel(candidate) === label,
  );
  assert.ok(row, `Missing row ${label}`);
  const wrapper = byClass(row, "mbk-nav-ico")[0];
  assert.ok(wrapper, `Missing icon on ${label}`);
  const svg = elements(wrapper, (element) => element.tagName === "svg")[0];
  assert.ok(svg, `Missing icon SVG on ${label}`);
  return [attribute(wrapper, "class") ?? "", serializeOuter(svg)];
}

/** The variant disclosures beside the screen rows that own variants. */
export function variantToggles(node: Node): Element[] {
  return elements(
    node,
    (element) =>
      element.tagName === "button" &&
      attribute(element, "class") === "mbk-nav-variants-toggle",
  );
}

/** The destinations of a navigation filter's linked options. */
export function filterTargets(node: Node): (string | undefined)[][] {
  return byClass(node, "mbk-nav-filter-opt")
    .filter((option) => option.tagName === "a")
    .map((option) => [
      textContent(option).trim(),
      attribute(option, "data-mokly-link"),
    ]);
}
