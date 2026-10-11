import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import { generatedViews } from "../packages/viewer/dist/components/views.js";

import {
  attribute,
  byClass,
  designCatalogue,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import {
  children,
  hasClass,
  previews,
  renders,
  type Viewport,
} from "./helpers/design_stacks.js";
import { textOutput } from "./helpers/generated_text.js";

/** Designs that stack both versions inside one device chrome. */
const STACKED = [
  ["design/changes/diff-controls/overlay", "overlay"],
  ["design/changes/diff-controls/overlay-long", "overlay"],
  ["design/changes/diff-controls/overlay-panel", "overlay"],
  ["design/changes/outcomes/difference", "difference"],
  ["design/browse/appearance/workspaces/difference", "difference"],
] as const;

/** Designs that keep one device chrome per version. */
const SIDE_BY_SIDE = [
  "design/changes/outcomes/changed",
  "design/changes/diff-controls/side-by-side-apart",
  "design/browse/appearance/workspaces/side-by-side",
  "design/changes/impact/styles/matched-excluded/matched",
  "design/changes/impact/styles/unresolved-unnamed/unresolved",
  "design/changes/impact/styles/unresolved-unnamed/unnamed",
] as const;

const CHROME: Record<Viewport, string> = {
  desktop: "browser-frame",
  mobile: "phone-frame",
};

const SCREEN: Record<Viewport, string> = {
  desktop: "browser-viewport",
  mobile: "phone-screen",
};

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
        const long = id === "design/changes/diff-controls/overlay-long";
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

/** Every generated design output: each screen view and saved sample view. */
async function designOutputs(): Promise<string[]> {
  const { manifest } = await designCatalogue;
  return manifest.entries.flatMap((entry) => {
    if (!entry.path.startsWith("design/")) return [];
    return generatedViews(entry).map((view) => view.path);
  });
}

/** Regions that depict a comparison, one of its panes, or a stacked layer. */
const COMPARISON_REGIONS = [
  "mbk-compare",
  "mbk-compare-side",
  "mbk-stack-layer",
];

test("links inside every depicted comparison and pane sample do nothing", async () => {
  const { outputs } = await designCatalogue;
  let regions = 0;
  let samples = 0;
  for (const route of await designOutputs()) {
    const html = textOutput(outputs, route);
    assert.ok(html, route);
    const document = parse(html);
    const depicted = COMPARISON_REGIONS.flatMap((name) =>
      byClass(document, name),
    );
    if (depicted.length > 0 && route.startsWith("design/library/"))
      samples += 1;
    for (const region of depicted) {
      regions += 1;
      assert.deepEqual(
        elements(region, (node) => node.tagName === "a").map((link) =>
          attribute(link, "data-mokly-link"),
        ),
        [],
        route,
      );
    }
  }
  assert.ok(regions > 0, "no depicted comparison was checked");
  assert.ok(samples > 0, "no shared pane sample was checked");
});

test("the long overlay rewords one section and keeps the rest in place", async () => {
  for (const { document, route } of await renders(
    "design/changes/diff-controls/overlay-long",
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
