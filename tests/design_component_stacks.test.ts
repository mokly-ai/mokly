import assert from "node:assert/strict";
import test from "node:test";

import {
  attribute,
  byClass,
  textContent,
  type Element,
} from "./helpers/design_catalogue.js";
import {
  children,
  hasClass,
  previews,
  renders,
  type Document,
} from "./helpers/design_stacks.js";

/** Component designs that stack both versions inside one bordered frame. */
const STACKED = [
  ["design-component-overlay", "overlay", "ce-action"],
  ["design-component-difference", "difference", "ce-action"],
  ["design-component-overlay-tall", "overlay", "ce-checklist"],
] as const;

/** Component designs that keep one bordered frame per version. */
const SIDE_BY_SIDE = [
  ["design-component-comparison", 2],
  ["design-component-controls-comparison", 2],
  ["design-component-removed", 1],
] as const;

/** The one comparison a preview depicts, with its caption. */
function comparison(preview: Element, where: string) {
  const [depicted, ...others] = byClass(preview, "ce-component-comparison");
  assert.ok(depicted, where);
  assert.equal(others.length, 0, where);
  const compares = byClass(depicted, "mbk-compare");
  assert.equal(compares.length, 1, where);
  const captions = byClass(depicted, "ce-caption");
  assert.equal(captions.length, 1, where);
  return { caption: textContent(captions[0]!), compare: compares[0]! };
}

/** The panel an artboard's inspector opens with. */
function openPanel(document: Document): string | undefined {
  const [inspector, ...others] = byClass(document, "ce-inspector");
  assert.ok(inspector);
  assert.equal(others.length, 0);
  const open = children(inspector).filter(
    (node) =>
      node.tagName === "details" && attribute(node, "open") !== undefined,
  );
  assert.ok(open.length <= 1);
  return open[0] && attribute(open[0], "data-panel");
}

test("component Overlay and Difference hold both versions in one bordered frame", async () => {
  for (const [id, mode, version] of STACKED) {
    const views = await renders(id);
    assert.equal(views.length, 2, `${id} renders both viewports in Light`);
    for (const { dark, document, route } of views) {
      assert.equal(dark, false, route);
      for (const [viewport, preview] of previews(document)) {
        const where = `${route} ${viewport}`;
        const { compare } = comparison(preview, where);
        assert.equal(attribute(compare, "data-compare-mode"), mode, where);
        assert.equal(byClass(compare, "mbk-compare-side").length, 0, where);
        assert.equal(byClass(compare, "mbk-compare-label").length, 0, where);
        assert.equal(byClass(compare, "browser-frame").length, 0, where);
        assert.equal(byClass(compare, "phone-frame").length, 0, where);
        const frames = byClass(compare, "ce-canvas");
        assert.equal(frames.length, 1, `${where}: one bordered frame`);
        assert.ok(hasClass(frames[0]!, `ce-canvas--${viewport}`), where);
        const [caption, scroller, ...rest] = children(frames[0]!);
        assert.equal(rest.length, 0, where);
        assert.ok(caption && hasClass(caption, "ce-canvas-label"), where);
        assert.ok(
          scroller && hasClass(scroller, "mbk-stack-viewport"),
          `${where}: the caption sits above the one shared viewport`,
        );
        const [stack, ...scrollbar] = children(scroller);
        assert.ok(stack && hasClass(stack, "mbk-stack"), where);
        const layers = children(stack);
        assert.deepEqual(
          layers.map((layer) => attribute(layer, "class")),
          [
            "mbk-stack-layer mbk-stack-layer--before",
            "mbk-stack-layer mbk-stack-layer--after",
          ],
          where,
        );
        for (const layer of layers) {
          const [content, ...more] = children(layer);
          assert.equal(more.length, 0, where);
          assert.ok(content && hasClass(content, "ce-canvas-content"), where);
          assert.equal(byClass(content, version).length, 1, where);
        }
        if (version === "ce-action")
          assert.deepEqual(
            layers.map((layer) => byClass(layer, "ce-action--before").length),
            [1, 0],
            `${where}: the Before version sits below the Current one`,
          );
        const tall = id === "design-component-overlay-tall";
        assert.equal(
          attribute(scroller, "data-scrolled") !== undefined,
          tall,
          where,
        );
        assert.deepEqual(
          scrollbar.map((node) => attribute(node, "class")),
          tall ? ["mbk-stack-scrollbar"] : [],
          where,
        );
      }
    }
  }
});

test("component stacks keep the comparison screen's caption and inspector", async () => {
  const [side] = await renders("design-component-comparison");
  const expected = new Map(
    previews(side!.document).map(([viewport, preview]) => [
      viewport,
      comparison(preview, viewport).caption,
    ]),
  );
  for (const id of ["design-component-overlay", "design-component-difference"])
    for (const { document, route } of await renders(id)) {
      assert.equal(openPanel(document), openPanel(side!.document), route);
      for (const [viewport, preview] of previews(document))
        assert.equal(
          comparison(preview, route).caption,
          expected.get(viewport),
          `${route} ${viewport}`,
        );
    }
});

test("Side by side keeps one bordered frame per component version", async () => {
  for (const [id, frames] of SIDE_BY_SIDE)
    for (const { document, route } of await renders(id))
      for (const [viewport, preview] of previews(document)) {
        const where = `${route} ${viewport}`;
        const { compare } = comparison(preview, where);
        assert.equal(attribute(compare, "data-compare-mode"), "side", where);
        assert.equal(byClass(compare, "mbk-stack").length, 0, where);
        const sides = byClass(compare, "mbk-compare-side");
        assert.deepEqual(
          sides.map((side) =>
            textContent(byClass(side, "mbk-compare-label")[0]!),
          ),
          ["Before", "Current"],
          where,
        );
        assert.equal(byClass(compare, "ce-canvas").length, frames, where);
        for (const side of sides)
          assert.ok(byClass(side, "ce-canvas").length <= 1, where);
      }
});

test("the tall Checklist rewords one step and keeps every other one", async () => {
  for (const { document, route } of await renders(
    "design-component-overlay-tall",
  ))
    for (const [viewport, preview] of previews(document)) {
      const where = `${route} ${viewport}`;
      const steps = (side: "before" | "after") => {
        const layer = byClass(preview, `mbk-stack-layer--${side}`)[0];
        assert.ok(layer, where);
        return byClass(layer, "ce-checklist-steps").flatMap((list) =>
          children(list).map((step) => ({
            complete: attribute(step, "data-complete") !== undefined,
            label: textContent(byClass(step, "ce-checklist-label")[0]!),
          })),
        );
      };
      const before = steps("before");
      const after = steps("after");
      assert.ok(before.length >= 8, `${where}: taller than its frame`);
      assert.equal(after.length, before.length, where);
      assert.deepEqual(
        after.map((step) => step.complete),
        before.map((step) => step.complete),
        where,
      );
      assert.equal(
        before.filter((step, index) => step.label !== after[index]!.label)
          .length,
        1,
        `${where}: exactly one reworded step`,
      );
    }
});
