/**
 * One generated product page read back as markup: what its own screen draws
 * inside the `main` landmark, and the parts a policy test asks about by name.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseFragment } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

import { screenFile } from "./catalogue-paths";
import type { Scheme, Viewport } from "./catalogue-paths";
import {
  attribute,
  byClass,
  childElements,
  elements,
  label,
} from "./design-site-test-helpers";

type Element = DefaultTreeAdapterMap["element"];

/** One drawn page: the whole document, and its `main` landmark parsed. */
export interface DrawnPage {
  html: string;
  main: DefaultTreeAdapterMap["documentFragment"];
}

export function drawnPage(
  id: string,
  viewport: Viewport = "desktop",
  scheme: Scheme = "light",
): DrawnPage {
  const html = readFileSync(screenFile(id, viewport, scheme), "utf8");
  return { html, main: parseFragment(html.slice(html.indexOf("<main"))) };
}

/** Every drawn action, as its tone and its label, in document order. */
export function actions(page: DrawnPage): [string, string][] {
  return elements(page.main, (element) =>
    /^firna-button-[a-z]+$/.test(attribute(element, "data-testid") ?? ""),
  ).map((element) => [
    (attribute(element, "data-testid") ?? "").replace("firna-button-", ""),
    label(element),
  ]);
}

/** Every drawn action that its running write holds busy, by its label. */
export function busyActions(page: DrawnPage): string[] {
  return elements(
    page.main,
    (element) =>
      /^firna-button-[a-z]+$/.test(attribute(element, "data-testid") ?? "") &&
      attribute(element, "aria-busy") === "true",
  ).map(label);
}

/**
 * The one drawn action that its running write holds busy, or a failure that
 * names the page.
 */
export function busyControl(page: DrawnPage, where: string): Element {
  const [found, ...more] = elements(
    page.main,
    (element) =>
      /^firna-button-[a-z]+$/.test(attribute(element, "data-testid") ?? "") &&
      attribute(element, "aria-busy") === "true",
  );
  assert.ok(found, where + " holds no control busy");
  assert.equal(more.length, 0, where + " holds more than one control busy");
  return found;
}

/** Every link whose text is exactly this name. */
export function links(page: DrawnPage, name: string): Element[] {
  return elements(
    page.main,
    (element) => element.tagName === "a" && label(element) === name,
  );
}

/** The catalogue destination one link leads to, or nothing for a real `href`. */
export function destination(link: Element): string | undefined {
  return attribute(link, "data-mokly-link");
}

/** Every read-only fact, as its label and its value. */
export function facts(page: DrawnPage): [string, string][] {
  return byClass(page.main, "fo-facts").flatMap((list) =>
    childElements(list).map((pair): [string, string] => {
      const [term, value] = childElements(pair);
      return [term ? label(term) : "", value ? label(value) : ""];
    }),
  );
}

/** How many steps the page's progress strip claims as done. */
export function stepsDone(page: DrawnPage): number {
  return byClass(page.main, "fo-steps").flatMap((strip) =>
    elements(
      strip,
      (element) => attribute(element, "data-complete") !== undefined,
    ),
  ).length;
}

/** Every pending label on the page, and whether it is shown or only announced. */
export function pendingLabels(
  page: DrawnPage,
): [string, "visible" | "screen-reader-only"][] {
  return byClass(page.main, "fo-pending-label").map((element) => [
    label(element),
    (attribute(element, "class") ?? "").split(/\s+/).includes("fo-sr-only")
      ? "screen-reader-only"
      : "visible",
  ]);
}

/** The page's one waiting region, which names its read, or a failure. */
export function waitRegion(page: DrawnPage, where: string): Element {
  const [found, ...more] = byClass(page.main, "fo-wait");
  assert.ok(found, where + " draws no waiting region");
  assert.equal(more.length, 0, where + " draws more than one waiting region");
  assert.equal(attribute(found, "aria-busy"), "true", where);
  return found;
}

/** The section headings in order; one hidden from readers waits, as "". */
export function sectionHeadings(node: DrawnPage["main"] | Element): string[] {
  return elements(node, (element) => element.tagName === "h2").map((title) =>
    attribute(title, "aria-hidden") === "true" ? "" : label(title),
  );
}

/** The registered buttons inside one part, in document order. */
export function buttonsIn(node: Element): Element[] {
  return elements(node, (element) =>
    /^firna-button-[a-z]+$/.test(attribute(element, "data-testid") ?? ""),
  );
}

/**
 * Each registered button inside one part: its label, or the name of one that
 * draws its icon alone, and whether it is disabled.
 */
export function controlStates(node: Element): [string, boolean][] {
  return buttonsIn(node).map((button) => [
    label(button) || (attribute(button, "aria-label") ?? ""),
    attribute(button, "aria-disabled") === "true",
  ]);
}

/** Every link inside one part, in document order. */
export function linksIn(node: Element): Element[] {
  return elements(node, (element) => element.tagName === "a");
}

/** The settings rail's pane that the page marks current. */
export function currentPane(page: DrawnPage): string[] {
  return byClass(page.main, "fo-nav-item")
    .filter((pane) => attribute(pane, "aria-current") === "page")
    .map(label);
}

/** The one element of a class inside a part, or a failure naming it. */
export function only(
  node: DrawnPage["main"] | Element,
  className: string,
): Element {
  const [found, ...more] = byClass(node, className);
  assert.ok(found, "no " + className);
  assert.equal(more.length, 0, "more than one " + className);
  return found;
}

/** Whether a part holds a bar in place of a text that the answer supplies. */
function holdsBar(node: Element): boolean {
  return byClass(node, "fo-wait-text").length > 0;
}

/**
 * The placeholder rows of a waiting region, each in its own row's frame: list
 * rows, member rows and notes holding a bar, and each table's body rows that
 * do. A table's first row is its header.
 */
export function placeholderRows(node: Element): Element[] {
  const rows = ["content-list-row", "fo-member-row", "fo-note"]
    .flatMap((frame) => byClass(node, frame))
    .filter(holdsBar);
  const tableRows = elements(
    node,
    (element) => attribute(element, "data-testid") === "firna-table",
  ).flatMap((table) => childElements(table).slice(1));
  return [...rows, ...tableRows.filter(holdsBar)];
}
