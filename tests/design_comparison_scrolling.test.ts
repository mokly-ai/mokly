import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import { generatedViews } from "../packages/viewer/dist/components/views.js";

import {
  attribute,
  byClass,
  designCatalogue,
  designEntries,
  elements,
  textContent,
  type Element,
} from "./helpers/design_catalogue.js";
import {
  children,
  hasClass,
  previews,
  renders,
} from "./helpers/design_stacks.js";
import { textOutput } from "./helpers/generated_text.js";

/** Section headings of each version, in order, for one reworded-section check. */
function reworded(before: Element, after: Element, where: string): void {
  const headings = (version: Element) =>
    byClass(version, "mbk-shot-sections").flatMap((sections) =>
      elements(sections, (node) => node.tagName === "h3").map(textContent),
    );
  const [first, second] = [headings(before), headings(after)];
  assert.ok(first.length >= 8, `${where}: longer than its frame`);
  assert.equal(second.length, first.length, where);
  assert.equal(
    first.filter((heading, index) => heading !== second[index]).length,
    1,
    `${where}: exactly one reworded section`,
  );
}

test("the panel overlay scrolls one app-shell panel for both versions", async () => {
  const views = await renders("design/changes/diff-controls/overlay-panel");
  assert.equal(views.length, 4, "both viewports in both schemes");
  for (const { document, route } of views)
    for (const [viewport, preview] of previews(document)) {
      const where = `${route} ${viewport}`;
      const [scroller, ...others] = byClass(preview, "mbk-stack-viewport");
      assert.ok(scroller, where);
      assert.equal(others.length, 0, where);
      assert.equal(
        attribute(scroller, "data-scrolled"),
        undefined,
        `${where}: the page itself is not scrolled`,
      );
      assert.deepEqual(
        children(scroller).map((node) => attribute(node, "class")),
        ["mbk-stack"],
        `${where}: no page scrollbar`,
      );
      const layers = children(children(scroller)[0]!);
      assert.equal(layers.length, 2, where);
      const shells = layers.map((layer) => {
        const [shell, ...rest] = children(layer);
        assert.equal(rest.length, 0, where);
        assert.ok(shell && hasClass(shell, "mbk-shot--app"), where);
        assert.deepEqual(
          children(shell).map((node) => attribute(node, "class")),
          viewport === "desktop"
            ? ["mbk-app-bar", "mbk-app-nav", "mbk-app-panel"]
            : ["mbk-app-bar", "mbk-app-panel", "mbk-app-nav"],
          `${where}: the bar and navigation sit outside the panel`,
        );
        const nav = byClass(shell, "mbk-app-nav")[0]!;
        assert.deepEqual(
          children(nav).map((item) => [
            item.tagName,
            attribute(item, "data-current") !== undefined,
          ]),
          ["span", "span", "span", "span"].map((tag, index) => [
            tag,
            index === 0,
          ]),
          where,
        );
        const panel = byClass(shell, "mbk-app-panel")[0]!;
        assert.equal(attribute(panel, "data-scrolled"), "", where);
        assert.deepEqual(
          children(panel).map((node) => attribute(node, "class")),
          ["mbk-app-panel-content", "mbk-scrollbar"],
          `${where}: the panel draws its own scrollbar`,
        );
        assert.equal(byClass(panel, "mbk-scrollbar-thumb").length, 1, where);
        return shell;
      });
      reworded(shells[0]!, shells[1]!, where);
    }
});

test("Side by side scrolled apart leaves each version at its own place", async () => {
  const views = await renders(
    "design/changes/diff-controls/side-by-side-apart",
  );
  assert.equal(views.length, 4, "both viewports in both schemes");
  for (const { document, route } of views)
    for (const [viewport, preview] of previews(document)) {
      const where = `${route} ${viewport}`;
      const [compare, ...others] = byClass(preview, "mbk-compare");
      assert.ok(compare, where);
      assert.equal(others.length, 0, where);
      assert.equal(attribute(compare, "data-compare-mode"), "side", where);
      const sides = byClass(compare, "mbk-compare-side");
      assert.equal(sides.length, 2, where);
      const pages = sides.map((side) => {
        const chromes = byClass(
          side,
          viewport === "desktop" ? "browser-frame" : "phone-frame",
        );
        assert.equal(chromes.length, 1, `${where}: one chrome per version`);
        const [view, ...more] = byClass(chromes[0]!, "mbk-page-viewport");
        assert.ok(view, where);
        assert.equal(more.length, 0, where);
        assert.deepEqual(
          children(view).map((node) => attribute(node, "class")),
          ["mbk-shot mbk-shot--page", "mbk-scrollbar"],
          `${where}: each version draws its own scrollbar`,
        );
        return view;
      });
      assert.deepEqual(
        pages.map((view) => attribute(view, "data-scrolled")),
        ["short", "long"],
        `${where}: the versions are drawn at different places`,
      );
      reworded(pages[0]!, pages[1]!, where);
    }
});

/** The screens and saved samples whose band shows a diff mode. */
const DIFF_MODE_DESIGNS = [
  "design/browse/appearance/workspaces/difference",
  "design/browse/appearance/workspaces/side-by-side",
  "design/changes/outcomes/moved",
  "design/changes/diff-controls/overlay",
  "design/changes/diff-controls/overlay-long",
  "design/changes/diff-controls/overlay-panel",
  "design/changes/diff-controls/side-by-side-apart",
  "design/components/pages/comparison",
  "design/components/controls/states/comparison",
  "design/components/pages/stacked/difference",
  "design/components/pages/stacked/overlay",
  "design/components/pages/stacked/overlay-tall",
  "design/components/states/removed",
  "design/changes/outcomes/changed",
  "design/changes/outcomes/difference",
  "design/changes/impact/styles/matched",
  "design/changes/impact/styles/unnamed",
  "design/changes/impact/styles/unresolved",
  "design/library/controls/comparison-toolbar/difference",
  "design/library/controls/comparison-toolbar/overlay",
  "design/library/controls/comparison-toolbar/side-by-side",
  "design/library/controls/comparison-toolbar/side-by-side-apart",
];

/** The designs that depict Scroll together switched off. */
const SCROLLING_APART = new Set([
  "design/changes/diff-controls/side-by-side-apart",
  "design/library/controls/comparison-toolbar/side-by-side-apart",
]);

test("every diff-mode band draws Scroll together after its modes, and Current never does", async () => {
  const { outputs } = await designCatalogue;
  const entries = await designEntries(
    (entry) =>
      entry.path.startsWith("design/") &&
      (entry.kind === "screen" || entry.kind === "component"),
    "comparison bands",
  );
  const views = entries.flatMap((entry) => {
    if (entry.kind !== "screen" && entry.kind !== "component") return [];
    if (!entry.path.startsWith("design/")) return [];
    return generatedViews(entry).map((view) => ({
      id: entry.path,
      route: view.path,
    }));
  });
  const diffModes = new Set<string>();
  let current = 0;
  for (const { id, route } of views) {
    const html = textOutput(outputs, route);
    assert.ok(html, route);
    for (const toolbar of byClass(parse(html), "mbk-cmp-toolbar")) {
      const [modes, ...rest] = children(toolbar);
      assert.ok(modes && hasClass(modes, "mbk-seg"), route);
      const active = byClass(modes, "active").map((node) =>
        textContent(node).trim(),
      );
      assert.equal(active.length, 1, `${route}: one selected mode`);
      if (active[0] === "Current") {
        current += 1;
        assert.deepEqual(rest, [], `${route}: Current has nothing to sync`);
        continue;
      }
      diffModes.add(id);
      assert.deepEqual(
        rest.map((node) => [node.tagName, attribute(node, "class")]),
        [
          ["label", "mbk-cmp-sync"],
          ["span", "mbk-cmp-refresh"],
        ],
        `${route}: Scroll together sits between the modes and Refresh`,
      );
      const label = rest[0]!;
      assert.equal(textContent(label).trim(), "Scroll together", route);
      const inputs = elements(label, (node) => node.tagName === "input");
      assert.equal(inputs.length, 1, route);
      assert.equal(attribute(inputs[0]!, "type"), "checkbox", route);
      assert.equal(attribute(inputs[0]!, "role"), "switch", route);
      assert.equal(
        attribute(inputs[0]!, "checked") !== undefined,
        !SCROLLING_APART.has(id),
        `${route}: on unless the design depicts it off`,
      );
      assert.deepEqual(
        byClass(label, "mbk-cmp-sync-track").map((track) =>
          attribute(track, "aria-hidden"),
        ),
        ["true"],
        route,
      );
    }
  }
  assert.deepEqual([...diffModes].sort(), [...DIFF_MODE_DESIGNS].sort());
  assert.ok(current > 0, "no Current band was checked");
});
