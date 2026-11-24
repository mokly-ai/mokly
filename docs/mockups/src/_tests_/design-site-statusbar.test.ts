/**
 * The design file's status bar under the footer frame. Every page but the
 * home draws the whole bar as a depiction: hidden from assistive technology,
 * with nothing that takes focus. On the home the zoom pill is a control, a
 * group of the Zoom out and Zoom in buttons around the zoom, and the file
 * and the people stay depicted. `design-site-chrome.test.ts` checks the
 * file and the people that every bar depicts.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  attribute,
  byClass,
  childElements,
  elements,
  label,
  siteDocument,
  siteScreens,
  type Element,
} from "./design-site-test-helpers";

/** The home, whose status bar holds the one control of any status bar. */
const home = "design/site/home";

/** The zoom that the pill of the home and of each of its zoom states shows. */
const homeZooms: ReadonlyArray<readonly [string, string]> = [
  [home, "100%"],
  ["design/site/home/zoomed-out", "41%"],
  ["design/site/home/zoomed-in", "156%"],
];

/** Every element inside one node that takes focus or acts on a press. */
function controls(node: Element): Element[] {
  return elements(
    node,
    (child) =>
      ["a", "button", "input", "select", "textarea"].includes(child.tagName) ||
      attribute(child, "tabindex") !== undefined,
  );
}

/** The status bar of one generated document. */
function statusBar(id: string, viewport: "mobile" | "desktop"): Element {
  const { document } = siteDocument(id, viewport);
  const bar = byClass(document, "site-statusbar")[0];
  assert.ok(bar, id);
  return bar;
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the status bar of every page but the home is a depiction`, () => {
    for (const id of siteScreens.filter((screen) => screen !== home)) {
      const bar = statusBar(id, viewport);
      assert.equal(attribute(bar, "aria-hidden"), "true", id);
      assert.equal(
        label(byClass(bar, "site-statusbar-zoom")[0]!),
        "−100%+",
        id,
      );
      assert.deepEqual(controls(bar), [], `${id}: nothing in the bar acts`);
    }
  });

  test(`${viewport}: the home's zoom pill is a group of Zoom out, the zoom and Zoom in`, () => {
    for (const [id, zoom] of homeZooms) {
      const bar = statusBar(id, viewport);
      assert.equal(attribute(bar, "aria-hidden"), undefined, id);
      assert.deepEqual(
        byClass(bar, "site-statusbar-item").map((item) =>
          attribute(item, "aria-hidden"),
        ),
        ["true", "true"],
        `${id}: the file and the people stay depicted`,
      );
      const groups = byClass(bar, "site-statusbar-zoom");
      assert.equal(groups.length, 1, id);
      const group = groups[0]!;
      assert.deepEqual(
        [attribute(group, "role"), attribute(group, "aria-label")],
        ["group", "Zoom"],
        id,
      );
      assert.deepEqual(
        childElements(group).map((child) => [
          child.tagName,
          attribute(child, "aria-label") ?? label(child),
          attribute(child, "type") ?? attribute(child, "aria-live"),
        ]),
        [
          ["button", "Zoom out", "button"],
          ["span", zoom, "polite"],
          ["button", "Zoom in", "button"],
        ],
        id,
      );
      assert.deepEqual(
        controls(bar),
        controls(group),
        `${id}: the zoom's buttons are the bar's only controls`,
      );
    }
  });
}
