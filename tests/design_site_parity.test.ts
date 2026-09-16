/**
 * The promoted site mockups and the site itself still hold two copies of the
 * Folio layout rules. This test compares them per composition: every rule
 * whose selector both sides declare must declare the same values, ignoring
 * the responsive mechanism, which the mockups express as `data-site-viewport`
 * and the site as width queries. Differences that are structural, not drift,
 * are listed in `INTENTIONAL` with the reason they are allowed, and the test
 * fails when one of those is silently resolved or disappears.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const MOCKUP = path.join(repositoryRoot, "examples/basic/generated/site.css");
const STYLES = path.join(repositoryRoot, "site/src/styles");

/** The lowest number of shared rules this comparison must still cover. */
const SHARED_FLOOR = 200;

/**
 * Selectors both sides declare and are expected to differ, with the reason.
 * Each entry is proved to still exist and still differ, so resolving one
 * means deleting its line rather than leaving a stale exception behind.
 */
const INTENTIONAL: Readonly<Record<string, string>> = {
  ".site-detail--split":
    "the depicted module detail sets its own gap; the site inherits the detail gap below the breakpoint",
  ".site-doc-disclosure":
    "the site publishes the tree as a disclosure and hides it above the breakpoint; the mockup depicts one composition per screen",
  ".site-doc-tree":
    "the mockup pins the tree from the rule itself; the site pins it from the enclosing column so the disclosure can reuse the tree",
  ".site-doc-tree-scroll":
    "the scroller only overflows inside the site's pinned column, for the same reason",
  ".site-document-body":
    "the mockup wraps each part of a document in a section element; the site renders a flat Markdown body",
  ".site-document-body h2":
    "the site rules its flat body from the heading's own border, which the mockup's sections do not need",
  ".site-document-body p":
    "the site holds the reading measure on every child of the flat body rather than on paragraphs",
  ".site-filter":
    "the mockup styles the filter inside the depicted navigation column; the site only ever renders its detail variant",
  ".site-pager":
    "the mockup stacks the cards by giving them the full measure; the site stacks them with the flex direction",
  ".site-pager-item": "the same stacking difference",
  ".site-pager-item--next": "the same stacking difference",
  ".site-release-index":
    "the depicted index is a sticky rail beside the entries; the site lists the real releases above them",
  ".site-topbar-menu":
    "the depicted shell keeps the menu control; the site's miniature drops it because no real value backs it",
  ".site-tree":
    "the depicted shell keeps the navigation column below the breakpoint; the site's miniature drops it",
};

interface Rule {
  readonly at: string | null;
  readonly declarations: readonly string[];
  readonly selector: string;
}

/** Every rule in `source`, descending only into width-based queries. */
function rules(source: string, at: string | null = null): Rule[] {
  const found: Rule[] = [];
  let index = 0;
  while (index < source.length) {
    const brace = source.indexOf("{", index);
    if (brace === -1) break;
    const prelude = source.slice(index, brace).trim().replace(/\s+/g, " ");
    let depth = 0;
    let end = source.length - 1;
    for (let scan = brace; scan < source.length; scan += 1) {
      if (source[scan] === "{") depth += 1;
      else if (source[scan] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = scan;
          break;
        }
      }
    }
    const inner = source.slice(brace + 1, end);
    if (prelude.startsWith("@")) {
      if (/^@media \([^)]*width/.test(prelude))
        found.push(...rules(inner, prelude));
    } else {
      found.push({
        at,
        declarations: inner
          .split(";")
          .map((line) => line.trim().replace(/\s+/g, " "))
          .filter((line) => line.length > 0),
        selector: prelude,
      });
    }
    index = end + 1;
  }
  return found;
}

const BOX = ["top", "right", "bottom", "left"] as const;

/** Expand `padding` and `margin` so a shorthand equals its longhands. */
function declare(into: Map<string, string>, declaration: string): void {
  const colon = declaration.indexOf(":");
  const property = declaration.slice(0, colon).trim();
  const value = declaration.slice(colon + 1).trim();
  if (property !== "padding" && property !== "margin") {
    into.set(property, value);
    return;
  }
  const parts = value.split(/ (?![^(]*\))/);
  const sides =
    parts.length === 1
      ? [parts[0], parts[0], parts[0], parts[0]]
      : parts.length === 2
        ? [parts[0], parts[1], parts[0], parts[1]]
        : parts.length === 3
          ? [parts[0], parts[1], parts[2], parts[1]]
          : parts;
  BOX.forEach((side, position) => {
    into.set(`${property}-${side}`, sides[position] ?? "");
  });
}

/** Drop the pinned composition and the mockup's root wrapper from a part. */
function normalize(part: string): string {
  return part
    .trim()
    .replace(/^\[data-site-viewport="(?:mobile|desktop)"\] /, "")
    .replace(/^\.site-root\[data-site-viewport="[a-z]+"\] /, "")
    .replace(/^\.site-root /, "")
    .replace(/\s+/g, " ");
}

/**
 * The declarations each selector resolves to at one composition: `wide` is
 * the widest published layout, `narrow` the layout below the breakpoint.
 */
function composition(
  list: readonly Rule[],
  view: "narrow" | "wide",
): Map<string, Map<string, string>> {
  const resolved = new Map<string, Map<string, string>>();
  for (const rule of list) {
    const pinned = /\[data-site-viewport="(mobile|desktop)"\]/.exec(
      rule.selector,
    );
    const query = rule.at ?? "";
    const forWide =
      pinned?.[1] === "desktop" || query.includes("min-width: 768px");
    const forNarrow =
      pinned?.[1] === "mobile" || query.includes("max-width: 767px");
    if (view === "wide" && (forNarrow || query.includes("max-width: 1100px")))
      continue;
    if (view === "narrow" && (forWide || query.includes("min-width: 1100px")))
      continue;
    for (const part of rule.selector.split(",")) {
      const selector = normalize(part);
      if (!selector.includes(".site-")) continue;
      const declarations = resolved.get(selector) ?? new Map<string, string>();
      for (const declaration of rule.declarations)
        declare(declarations, declaration);
      resolved.set(selector, declarations);
    }
  }
  // A box the composition removes carries no appearance, so only the removal
  // is compared; one side may reach it from a rule the other never writes.
  for (const [selector, declarations] of resolved) {
    if (declarations.get("display") === "none")
      resolved.set(selector, new Map([["display", "none"]]));
  }
  return resolved;
}

/** The mockup sheet and the site sheets, read once for both compositions. */
async function sheets(): Promise<{ mockup: Rule[]; site: Rule[] }> {
  const comments = /\/\*[\s\S]*?\*\//g;
  const mockup = (await fs.readFile(MOCKUP, "utf8")).replace(comments, "");
  const names = (await fs.readdir(STYLES))
    .filter((name) => name.endsWith(".css") && name !== "tokens.css")
    .sort();
  let site = "";
  for (const name of names)
    site += (await fs.readFile(path.join(STYLES, name), "utf8")).replace(
      comments,
      "",
    );
  return { mockup: rules(mockup), site: rules(site) };
}

/** Selectors declared on both sides whose declarations disagree. */
function drifted(
  mockup: Map<string, Map<string, string>>,
  site: Map<string, Map<string, string>>,
): string[] {
  const different: string[] = [];
  for (const [selector, declarations] of mockup) {
    const other = site.get(selector);
    if (!other) continue;
    const left = [...declarations].sort().map(String).join(" | ");
    const right = [...other].sort().map(String).join(" | ");
    if (left !== right) different.push(selector);
  }
  return different;
}

for (const view of ["wide", "narrow"] as const) {
  test(`the ${view} composition agrees with the mockups`, async () => {
    const { mockup, site } = await sheets();
    const depicted = composition(mockup, view);
    const shipped = composition(site, view);
    const shared = [...depicted.keys()].filter((key) => shipped.has(key));
    assert.ok(
      shared.length >= SHARED_FLOOR,
      `only ${shared.length} shared rules; the comparison stopped covering the layout`,
    );
    const different = drifted(depicted, shipped);
    assert.deepEqual(
      different.filter((selector) => !(selector in INTENTIONAL)),
      [],
      "the mockups and the site disagree on a shared rule",
    );
  });
}

test("every recorded difference is still shared and still different", async () => {
  const { mockup, site } = await sheets();
  const views = (["wide", "narrow"] as const).map((view) => ({
    depicted: composition(mockup, view),
    shipped: composition(site, view),
  }));
  for (const selector of Object.keys(INTENTIONAL)) {
    assert.ok(
      views.some(
        ({ depicted, shipped }) =>
          depicted.has(selector) &&
          shipped.has(selector) &&
          drifted(depicted, shipped).includes(selector),
      ),
      `${selector} no longer differs; remove it from the recorded list`,
    );
  }
});
