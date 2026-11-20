import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { test } from "node:test";

import { repositoryRoot } from "./root";

const document = readFileSync(
  resolve(repositoryRoot, "apps/app/public/index.html"),
  "utf8",
);

/** The stylesheets the application's own document links, in link order. */
function linkedStylesheets(): string[] {
  const prefix = "/";
  return [...document.matchAll(/href="([^"]+\.css)"/g)].map((match) => {
    const href = match[1];
    assert.ok(href?.startsWith(prefix), `${href} must start with ${prefix}`);
    return href.slice(prefix.length);
  });
}

function stylesheetText(href: string): string {
  const path = href.startsWith("folio/")
    ? resolve(
        repositoryRoot,
        "docs/mockups/styles",
        href.slice("folio/".length),
      )
    : href === "mokly-viewer/styles.css"
      ? resolve(repositoryRoot, "node_modules/@mokly/viewer/dist/styles.css")
      : resolve(repositoryRoot, "apps/app/public", href);
  return readFileSync(path, "utf8");
}

/** Every rule the document can reach, following the catalogue's `@import`s. */
function definedClasses(): ReadonlySet<string> {
  const classes = new Set<string>();
  const seen = new Set<string>();
  const queue = linkedStylesheets();
  while (queue.length > 0) {
    const href = queue.shift() as string;
    if (seen.has(href)) continue;
    seen.add(href);
    const text = stylesheetText(href);
    for (const match of text.matchAll(/@import "([^"]+)"/g)) {
      const directory = href.slice(0, href.lastIndexOf("/") + 1);
      queue.push(directory + match[1]);
    }
    for (const match of text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      classes.add(match[1]);
    }
  }
  return classes;
}

/**
 * Every selector one stylesheet declares a rule for, one entry per selector in
 * a comma-separated list and with its whitespace settled, so the same rule
 * written two ways compares equal. At-rules contribute the selectors inside
 * them rather than themselves: a rule nested in a media query is still a
 * declaration of that selector.
 */
function declaredSelectors(text: string): Set<string> {
  const selectors = new Set<string>();
  const source = text.replaceAll(/\/\*[\s\S]*?\*\//g, " ");
  for (const rule of source.matchAll(/([^{}]+)\{/g)) {
    const head = rule[1].trim();
    if (head.length === 0 || head.startsWith("@")) continue;
    for (const one of head.split(",")) {
      const settled = one.trim().split(/\s+/).join(" ");
      if (settled.length > 0) selectors.add(settled);
    }
  }
  return selectors;
}

/** Every stylesheet the catalogue owns, whether or not the document links it. */
function catalogueStylesheets(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...catalogueStylesheets(path));
    else if (extname(entry.name) === ".css") found.push(path);
  }
  return found;
}

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if ([".ts", ".tsx"].includes(extname(entry.name))) found.push(path);
  }
  return found;
}

/**
 * Class names the application writes. A concatenated name — `"prefix-" + value`
 * — contributes its complete tokens only; the trailing prefix is skipped
 * because its whole point is that the suffix varies.
 */
function usedClasses(): Map<string, string> {
  const used = new Map<string, string>();
  for (const path of sourceFiles(resolve(repositoryRoot, "apps/app/src"))) {
    if (path.includes("/_tests_/") || path.includes("/generated/")) continue;
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(
      /className=(?:"([^"]*)"|\{([^}]*)\})/g,
    )) {
      const literals = match[1]
        ? [match[1]]
        : [...(match[2] ?? "").matchAll(/"([^"]*)"/g)].map((part) => part[1]);
      for (const literal of literals) {
        for (const token of literal.split(/\s+/)) {
          if (token.length === 0 || token.endsWith("-")) continue;
          if (!used.has(token)) used.set(token, path);
        }
      }
    }
  }
  return used;
}

test("the document links the catalogue's stylesheets and the app's own", () => {
  const linked = linkedStylesheets();
  assert.ok(linked.includes("folio/base.css"));
  assert.ok(linked.includes("mokly-viewer/styles.css"));
  assert.ok(linked.includes("folio/product/inventory.css"));
  assert.ok(linked.includes("app.css"));
});

test("every class the application writes is defined in a linked stylesheet", () => {
  const defined = definedClasses();
  const missing: string[] = [];
  for (const [token, path] of usedClasses()) {
    if (!defined.has(token)) missing.push(`${token} (${path})`);
  }
  assert.deepEqual(missing, []);
});

test("no selector is declared by both the catalogue and the app", () => {
  const app = declaredSelectors(
    readFileSync(resolve(repositoryRoot, "apps/app/public/app.css"), "utf8"),
  );
  const catalogue = new Set<string>();
  for (const path of catalogueStylesheets(
    resolve(repositoryRoot, "docs/mockups/styles"),
  )) {
    for (const selector of declaredSelectors(readFileSync(path, "utf8"))) {
      catalogue.add(selector);
    }
  }
  // The document links the catalogue before `app.css`, and the style sync
  // copies the catalogue in whole, so a rule declared in both is settled here
  // rather than by its owner — silently, and differently, on every change.
  const collisions = [...app].filter((selector) => catalogue.has(selector));
  assert.deepEqual(
    collisions.sort(),
    [],
    "the catalogue owns these; delete the app's copy",
  );
});
