/**
 * The cloud's Mokly check in the pull request drawing, and the settings
 * dialog's look over the viewer. The right panel opens on Changes, whose tab
 * holds the check card, and the embedded layout's side panel stays empty:
 * the card's summary counts the drawing's catalogue as `changes-check.md`
 * words it, and its one link opens the pull request's checks on GitHub. A
 * phone draws the same tab in the panel's closed sheet. The settings drawing
 * shows the dialog over the viewer on the Members pane that its rail opens.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parse } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

import { pullRequest } from "../fixtures/publications";
import { viewerCatalogue } from "../fixtures/viewer-catalogue";

import { screenFile } from "./catalogue-paths";
import type { Scheme, Viewport } from "./catalogue-paths";
import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
import type { Element } from "./design-site-test-helpers";
import { currentPane, drawnPage } from "./drawn-page";

type Node = DefaultTreeAdapterMap["node"];

const pullRequestPath = "product/viewer/pull-request";

/** One whole drawn document, the package's slots included. */
function page(id: string, viewport: Viewport, scheme: Scheme = "light"): Node {
  return parse(readFileSync(screenFile(id, viewport, scheme), "utf8"));
}

/** The one element of a class inside a part, or a failure naming it. */
function one(node: Node, name: string): Element {
  const [found, ...more] = byClass(node, name);
  assert.ok(found, "no " + name);
  assert.equal(more.length, 0, "more than one " + name);
  return found;
}

/** The one element with this id in a part, or a failure naming it. */
function byId(node: Node, id: string): Element {
  const [found, ...more] = elements(
    node,
    (element) => attribute(element, "id") === id,
  );
  assert.ok(found, "no #" + id);
  assert.equal(more.length, 0, "more than one #" + id);
  return found;
}

test("a pull request's drawing shows the cloud's Mokly check in the Changes tab", () => {
  const changed = viewerCatalogue.screens.filter(
    (screen) => screen.changed,
  ).length;
  assert.ok(changed > 0);
  for (const viewport of ["desktop", "mobile"] as const)
    for (const scheme of ["light", "dark"] as const) {
      const at = viewport + " " + scheme;
      const drawn = page(pullRequestPath, viewport, scheme);
      // The side panel holds nothing, so it takes no room beside the canvas.
      for (const slot of elements(
        drawn,
        (element) => attribute(element, "data-mokly-slot") === "sidePanel",
      ))
        assert.deepEqual(slot.childNodes, [], at);
      // The right panel shows its Changes tab, which holds the one card.
      assert.equal(
        attribute(byId(drawn, "mkc-panel-tab-changes"), "aria-current"),
        "true",
        at,
      );
      const card = one(
        byId(drawn, "mkc-panel-body-changes"),
        "fo-canvas-check",
      );
      assert.equal(byClass(drawn, "fo-canvas-check").length, 1, at);
      assert.equal(label(one(card, "fo-canvas-check-name")), "Mokly", at);
      // The catalogue has no new and no removed screen.
      assert.equal(
        label(one(card, "fo-canvas-check-summary")),
        changed + " changed, 0 added, 0 removed.",
        at,
      );
      // The card's one way on is a link to the check, not a control that the
      // application would have to write.
      const links = elements(card, (element) => element.tagName === "a");
      assert.deepEqual(
        links.map((link) => attribute(link, "href")),
        [pullRequest.github + "/checks"],
        at,
      );
      assert.equal(
        label(links[0]),
        pullRequest.number + " · " + pullRequest.title,
        at,
      );
      assert.equal(
        elements(card, (element) =>
          /^firna-button-/.test(attribute(element, "data-testid") ?? ""),
        ).length,
        0,
        at,
      );
      // The tab already names Changes, so the card draws no heading.
      assert.equal(
        elements(card, (element) => /^h[1-6]$/.test(element.tagName)).length,
        0,
        at,
      );
    }
});

test("a branch's ready viewer draws no check", () => {
  for (const viewport of ["desktop", "mobile"] as const)
    assert.equal(
      byClass(page("product/viewer/standalone", viewport), "fo-canvas-check")
        .length,
      0,
      viewport,
    );
});

test("the settings drawing shows the dialog over the viewer on its Members pane", () => {
  const settings = "product/viewer/standalone/settings";
  for (const viewport of ["desktop", "mobile"] as const) {
    const drawn = drawnPage(settings, viewport);
    assert.ok(drawn.html.includes('data-mkc-screen="' + settings + '"'));
    assert.deepEqual(
      elements(drawn.main, (element) => element.tagName === "h1").map(label),
      ["Members"],
      viewport,
    );
  }
  // The desktop dialog's rail marks Members as the current pane.
  assert.deepEqual(currentPane(drawnPage(settings, "desktop")), ["Members"]);
});
