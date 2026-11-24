/**
 * The stylesheets of the site mockups, read from the authored sources with
 * no catalogue build, so the site's own tests in `apps/site` read the same
 * list as the mockup tests. A site document links the font sheets of the
 * site rule of `mokly.config.json`, then the bundle of the CSS that its
 * entry module imports.
 */

import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import { importedStylesheets } from "./imported-stylesheets";

/** Root of the repository that owns the mockups. */
const repositoryRoot = resolve(import.meta.dirname, "../../../..");

/** The directory that holds the catalogue's entry modules. */
const entriesRoot = resolve(repositoryRoot, "docs/mockups/src/entries");

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
 * The entry module of one site screen, from its file-derived path: the
 * module named after the path, or the directory owner's `index` module.
 */
function entryModule(path: SiteScreenPath): string {
  const file = [`${path}.mockup.tsx`, `${path}/index.mockup.tsx`]
    .map((name) => resolve(entriesRoot, name))
    .find((candidate) =>
      statSync(candidate, { throwIfNoEntry: false })?.isFile(),
    );
  assert.ok(file, `Missing entry module for ${path}`);
  return file;
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
      importedStylesheets(entryModule(path)).map((sheet) =>
        relative(repositoryRoot, sheet),
      ),
  );
  return [...new Set([...siteRuleStylesheets(), ...imported])];
}
