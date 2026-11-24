import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import type {
  CatalogueNode,
  CatalogueRecord,
  CatalogueScreen,
} from "@mokly/viewer";

import { catalogueEntries, catalogueIndex } from "./catalogue-index";
import { catalogueRoot, screenFile, screenView } from "./catalogue-paths";
import type { Scheme, Viewport } from "./catalogue-paths";
import { importedStylesheets } from "./imported-stylesheets";

type Node = DefaultTreeAdapterMap["node"];
export type Element = DefaultTreeAdapterMap["element"];

/** Root of the repository that owns the mockups. */
export const repositoryRoot = resolve(catalogueRoot, "../..");

/** The canonical site screens, in the order of the site tour. */
export const siteScreens = [
  "design/site/home",
  "design/site/docs",
  "design/site/changelog",
  "design/site/pricing",
  "design/site/terms",
  "design/site/privacy",
  "design/site/complaints",
  "design/site/security",
] as const;

/** The entry path of one canonical site screen. */
export type SiteScreenPath = (typeof siteScreens)[number];

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

/** The configuration rule that links the font sheets to every site document. */
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

/** The sheets that the site rule of `mokly.config.json` links, in link order. */
function siteRuleStylesheets(): string[] {
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
 * The order in which all site CSS reads the site screens: a legal document
 * first, so that the legal sheet follows the shared sheets, as the header of
 * `docs/mockups/styles/site/base.css` orders the areas, then every site
 * screen in the order of the site tour.
 */
const styleOrder = [...new Set(["design/site/terms", ...siteScreens] as const)];

/**
 * The site stylesheets as repository paths, in the cascade order of a site
 * document: the font sheets that the site rule of `mokly.config.json` links,
 * then the CSS that the screen's entry module reaches through its imports,
 * which Mokly bundles after the configured sheets. Without a screen, the
 * list holds the CSS of every site screen, each sheet at its first reach in
 * `styleOrder`.
 */
export function siteStylesheets(screen?: SiteScreenPath): string[] {
  const imported = (screen === undefined ? styleOrder : [screen]).flatMap(
    (path) =>
      importedStylesheets(
        resolve(repositoryRoot, siteEntry(path).details.sourcePath),
      ).map((sheet) => relative(repositoryRoot, sheet)),
  );
  return [...new Set([...siteRuleStylesheets(), ...imported])];
}

/**
 * Read the site styles as one policy input, in the cascade order of a site
 * document: the CSS of one screen, or without a screen of every site screen.
 */
export function siteStyles(screen?: SiteScreenPath): string {
  return siteStylesheets(screen)
    .map((path) => readFileSync(resolve(repositoryRoot, path), "utf8"))
    .join("\n");
}

/** One flat rule of a stylesheet: its selector list and its declarations. */
export interface CssRule {
  declarations: string;
  selector: string;
}

/** Every flat rule of one stylesheet source, with its comments removed. */
export function cssRules(source: string): CssRule[] {
  const found: CssRule[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  for (let match = pattern.exec(css); match; match = pattern.exec(css))
    found.push({ declarations: match[2]!, selector: match[1]! });
  return found;
}

/**
 * Assert that each named class has a hover rule in the site styles, or in
 * the styles of one screen, and that one of its hover rules changes more
 * than the colour.
 */
export function assertHoverChangesMoreThanColor(
  classNames: readonly string[],
  screen?: SiteScreenPath,
): void {
  const parsed = cssRules(siteStyles(screen));
  for (const className of classNames) {
    const matching = parsed.filter((rule) =>
      rule.selector.includes(`.${className}:hover`),
    );
    assert.ok(matching.length > 0, `missing hover for .${className}`);
    assert.ok(
      matching.some((rule) =>
        /(?:background|border|text-decoration|outline|box-shadow)/.test(
          rule.declarations,
        ),
      ),
      `.${className}:hover changes only color`,
    );
  }
}

/**
 * Assert that each selector has a rule of its own in the site styles, or in
 * the styles of one screen, whose declarations use the strong border role,
 * the boundary of a control.
 */
export function assertStrongBoundaries(
  selectors: readonly string[],
  screen?: SiteScreenPath,
): void {
  const parsed = cssRules(siteStyles(screen));
  for (const selector of selectors) {
    const rule = parsed.find((candidate) =>
      candidate.selector.split(",").some((part) => part.trim() === selector),
    );
    assert.ok(rule, selector);
    assert.match(rule.declarations, /--mk-color-border-strong/, selector);
  }
}
