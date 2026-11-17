import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type {
  CatalogueNode,
  CatalogueRecord,
  CatalogueScreen,
} from "@mokly/viewer";
import { parse, type DefaultTreeAdapterMap } from "parse5";

import { catalogueEntries, catalogueIndex } from "./catalogue-index";
import { catalogueRoot, screenFile, screenView } from "./catalogue-paths";
import type { Scheme, Viewport } from "./catalogue-paths";

type Node = DefaultTreeAdapterMap["node"];
export type Element = DefaultTreeAdapterMap["element"];

/** Root of the repository that owns the mockups. */
export const repositoryRoot = resolve(catalogueRoot, "../..");

/** Find one current entry's record in the catalogue index. */
export function siteEntry(id: string): CatalogueRecord {
  const entry = catalogueEntries().find((candidate) => candidate.path === id);
  assert.ok(entry, `Missing mockup entry ${id}`);
  return entry;
}

/**
 * How many rows sit directly in one folder of a catalogue section: the
 * subfolders beneath it and its own entries, with variants under their
 * parent. `pages` names the Specs section. A child shows in a section when
 * its subtree holds an entry of that section's kind, the rule by which the
 * viewer derives both sections from the index tree. Hidden rows count too.
 */
export function folderChildCount(
  section: "pages" | "components",
  folder: readonly string[],
): number {
  const model = catalogueIndex();
  const kinds = new Map(
    catalogueEntries(model).map((entry) => [entry.path, entry.kind]),
  );
  const shows = (node: CatalogueNode): boolean =>
    (node.kind === "entry" &&
      (kinds.get(node.path) === "component") === (section === "components")) ||
    (node.children ?? []).some(shows);
  const prefix = folder.map((part) => part.toLowerCase()).join("/");
  const find = (nodes: readonly CatalogueNode[]): CatalogueNode | undefined => {
    for (const node of nodes) {
      if (node.path === prefix) return node;
      const found = find(node.children ?? []);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return find(model.tree)?.children?.filter(shows).length ?? 0;
}

export function elements(
  node: Node,
  predicate: (node: Element) => boolean,
): Element[] {
  const matches = "tagName" in node && predicate(node) ? [node] : [];
  return "childNodes" in node
    ? [
        ...matches,
        ...node.childNodes.flatMap((child) => elements(child, predicate)),
      ]
    : matches;
}

export function attribute(node: Element, name: string): string | undefined {
  return node.attrs.find((candidate) => candidate.name === name)?.value;
}

/** The element children of one parsed node, without text or comments. */
export function childElements(node: Element): Element[] {
  return node.childNodes.filter(
    (child): child is Element => "tagName" in child,
  );
}

export function textContent(node: Node): string {
  if ("value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(textContent).join("") : "";
}

export function byClass(node: Node, className: string): Element[] {
  return elements(node, (element) =>
    (attribute(element, "class") ?? "").split(/\s+/).includes(className),
  );
}

/**
 * Read one generated screen document from the build output, with the
 * screen's index record and the document's output-relative path.
 */
export function siteDocument(
  id: string,
  viewport: Viewport,
  scheme: Scheme = "light",
): {
  document: DefaultTreeAdapterMap["document"];
  entry: CatalogueScreen;
  html: string;
  route: string;
} {
  const entry = siteEntry(id);
  assert.ok(entry.kind === "screen", `${id} is not a screen`);
  const html = readFileSync(screenFile(id, viewport, scheme), "utf8");
  const route = screenView(id, viewport, scheme);
  return { document: parse(html), entry, html, route };
}

/** Flatten rendered text for assertions independent of formatting whitespace. */
export function label(node: Node): string {
  return textContent(node).replace(/\s+/g, " ").trim();
}

/** The configuration rule that gives every site document its stylesheets. */
const siteStylesheetRule = "design/site/**/index.html";

/** Whether a parsed JSON value is an object with named fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Whether a parsed JSON value is a list of strings. */
function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/**
 * The site stylesheets as repository paths, in link order, read from the one
 * rule of `mokly.config.json` that gives every site document its sheets, so
 * the policy tests read exactly what the documents link.
 */
function siteStylesheets(): string[] {
  const config: unknown = JSON.parse(
    readFileSync(resolve(repositoryRoot, "mokly.config.json"), "utf8"),
  );
  const rules: unknown[] =
    isRecord(config) && Array.isArray(config.stylesheets)
      ? config.stylesheets
      : [];
  const rule: unknown = rules.find(
    (candidate) =>
      isRecord(candidate) && candidate.match === siteStylesheetRule,
  );
  const sheets: unknown = isRecord(rule) ? rule.stylesheets : undefined;
  assert.ok(
    isStringList(sheets),
    "mokly.config.json has no stylesheet list for " + siteStylesheetRule,
  );
  return sheets;
}

/**
 * Read all split mockup site styles as one policy input, in the order each
 * generated site document links them.
 */
export function siteStyles(): string {
  return siteStylesheets()
    .map((path) => readFileSync(resolve(repositoryRoot, path), "utf8"))
    .join("\n");
}
