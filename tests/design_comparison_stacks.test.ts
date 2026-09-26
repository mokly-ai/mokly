import assert from "node:assert/strict";
import test from "node:test";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import {
  attribute,
  byClass,
  designCatalogue,
  elements,
  textContent,
  type Element,
} from "./helpers/design_catalogue.js";

type Document = DefaultTreeAdapterMap["document"];
type Viewport = "desktop" | "mobile";

/** Designs that stack both versions inside one device chrome. */
const STACKED = [
  ["design-changes-overlay", "overlay"],
  ["design-changes-overlay-long", "overlay"],
  ["design-review-difference", "difference"],
  ["design-appearance-difference", "difference"],
] as const;

/** Designs that keep one device chrome per version. */
const SIDE_BY_SIDE = [
  "design-review-changed",
  "design-appearance-side-by-side",
  "design-review-style-matched",
  "design-review-style-unresolved",
  "design-review-style-unnamed",
] as const;

const CHROME: Record<Viewport, string> = {
  desktop: "browser-frame",
  mobile: "phone-frame",
};

const SCREEN: Record<Viewport, string> = {
  desktop: "browser-viewport",
  mobile: "phone-screen",
};

/** Every generated view of one design, in each scheme it renders in. */
async function renders(
  id: string,
): Promise<{ dark: boolean; document: Document; route: string }[]> {
  const { manifest, outputs } = await designCatalogue;
  const entry = manifest.entries.find((candidate) => candidate.id === id);
  assert.ok(entry?.kind === "screen", id);
  return [
    ...Object.values(entry.fragments).map((route) => [route, false] as const),
    ...Object.values(entry.darkFragments ?? {}).map(
      (route) => [route, true] as const,
    ),
  ].map(([route, dark]) => {
    const html = outputs.get(route);
    assert.ok(html, route);
    return { dark, document: parse(html), route };
  });
}

/** Both depicted previews of an artboard, each with its viewport. */
function previews(document: Document): [Viewport, Element][] {
  return byClass(document, "ce-preview-view").map((view) => {
    const viewport = attribute(view, "data-preview-viewport");
    assert.ok(viewport === "desktop" || viewport === "mobile");
    return [viewport, view];
  });
}

function children(node: Element): Element[] {
  return node.childNodes.filter(
    (child): child is Element => "tagName" in child,
  );
}

function hasClass(node: Element, name: string): boolean {
  return (attribute(node, "class") ?? "").split(/\s+/u).includes(name);
}

test("Overlay and Difference draw one chrome holding both versions", async () => {
  for (const [id, mode] of STACKED) {
    const views = await renders(id);
    assert.equal(views.length, 4, `${id} renders both viewports and schemes`);
    for (const { dark, document, route } of views) {
      const shown = previews(document);
      assert.deepEqual(
        shown.map(([viewport]) => viewport),
        ["mobile", "desktop"],
        route,
      );
      for (const [viewport, preview] of shown) {
        const where = `${route} ${viewport}`;
        const [comparison, ...others] = byClass(preview, "mbk-compare");
        assert.ok(comparison, where);
        assert.equal(others.length, 0, where);
        assert.equal(attribute(comparison, "data-compare-mode"), mode, where);
        assert.equal(byClass(comparison, "mbk-compare-side").length, 0, where);
        assert.equal(byClass(comparison, "mbk-compare-label").length, 0, where);
        const chromes = [
          ...byClass(comparison, "browser-frame"),
          ...byClass(comparison, "phone-frame"),
        ];
        assert.equal(chromes.length, 1, `${where}: one chrome`);
        assert.ok(hasClass(chromes[0]!, CHROME[viewport]), where);
        const screen = byClass(chromes[0]!, SCREEN[viewport])[0];
        assert.ok(screen, where);
        assert.equal(hasClass(screen, "mbk-screen-dark"), dark, where);
        const scroller = children(screen).find((node) =>
          hasClass(node, "mbk-stack-viewport"),
        );
        assert.ok(scroller, `${where}: the chrome's viewport scrolls`);
        const stacks = children(scroller).filter((node) =>
          hasClass(node, "mbk-stack"),
        );
        assert.equal(stacks.length, 1, where);
        assert.deepEqual(
          children(stacks[0]!).map((layer) => attribute(layer, "class")),
          [
            "mbk-stack-layer mbk-stack-layer--before",
            "mbk-stack-layer mbk-stack-layer--after",
          ],
          where,
        );
        const long = id === "design-changes-overlay-long";
        assert.equal(
          attribute(scroller, "data-scrolled") !== undefined,
          long,
          where,
        );
        assert.equal(
          byClass(scroller, "mbk-stack-scrollbar").length,
          long ? 1 : 0,
          where,
        );
      }
    }
  }
});

test("Side by side keeps one chrome per version", async () => {
  for (const id of SIDE_BY_SIDE) {
    for (const { document, route } of await renders(id)) {
      for (const [viewport, preview] of previews(document)) {
        const where = `${route} ${viewport}`;
        const [comparison, ...others] = byClass(preview, "mbk-compare");
        assert.ok(comparison, where);
        assert.equal(others.length, 0, where);
        assert.equal(attribute(comparison, "data-compare-mode"), "side");
        assert.equal(byClass(comparison, "mbk-stack").length, 0, where);
        const sides = byClass(comparison, "mbk-compare-side");
        assert.deepEqual(
          sides.map((side) =>
            textContent(byClass(side, "mbk-compare-label")[0]!),
          ),
          ["Before", "Current"],
          where,
        );
        for (const side of sides)
          assert.equal(byClass(side, CHROME[viewport]).length, 1, where);
      }
    }
  }
});

test("links inside a depicted comparison do nothing", async () => {
  const { manifest, outputs } = await designCatalogue;
  let comparisons = 0;
  for (const entry of manifest.entries) {
    if (entry.kind !== "screen" || !entry.id.startsWith("design-")) continue;
    for (const route of [
      ...Object.values(entry.fragments),
      ...Object.values(entry.darkFragments ?? {}),
    ]) {
      const html = outputs.get(route);
      assert.ok(html, route);
      for (const comparison of byClass(parse(html), "mbk-compare")) {
        comparisons += 1;
        assert.deepEqual(
          elements(comparison, (node) => node.tagName === "a").map((link) =>
            attribute(link, "data-mokly-link"),
          ),
          [],
          route,
        );
      }
    }
  }
  assert.ok(comparisons > 0, "no depicted comparison was checked");
});

test("the long overlay rewords one section and keeps the rest in place", async () => {
  for (const { document, route } of await renders(
    "design-changes-overlay-long",
  )) {
    for (const [viewport, preview] of previews(document)) {
      const where = `${route} ${viewport}`;
      const headings = (side: "before" | "after") => {
        const layer = byClass(preview, `mbk-stack-layer--${side}`)[0];
        assert.ok(layer, where);
        assert.equal(byClass(layer, "mbk-shot-hero").length, 1, where);
        return byClass(layer, "mbk-shot-sections").flatMap((sections) =>
          elements(sections, (node) => node.tagName === "h3").map((node) =>
            textContent(node),
          ),
        );
      };
      const before = headings("before");
      const after = headings("after");
      assert.ok(before.length >= 8, `${where}: a screen longer than its frame`);
      assert.equal(after.length, before.length, where);
      assert.equal(
        before.filter((heading, index) => heading !== after[index]).length,
        1,
        `${where}: exactly one reworded section`,
      );
    }
  }
});
