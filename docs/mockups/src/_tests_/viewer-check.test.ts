/**
 * The cloud's Mokly check in the pull request drawing, and the settings
 * dialog's look over the viewer. On a pointer viewport the embedded layout's
 * side panel holds the check card: its summary counts the drawing's
 * catalogue as `changes-check.md` words it, and its one link opens the pull
 * request's checks on GitHub. A phone draws no side panel. The settings
 * drawing shows the dialog over the viewer on the Members pane that its rail
 * opens.
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

test("a pull request's desktop drawing shows the cloud's Mokly check beside the stage", () => {
  const changed = viewerCatalogue.screens.filter(
    (screen) => screen.changed,
  ).length;
  assert.ok(changed > 0);
  for (const scheme of ["light", "dark"] as const) {
    const drawn = page(pullRequestPath, "desktop", scheme);
    const [slot, ...more] = elements(
      drawn,
      (element) => attribute(element, "data-mokly-slot") === "sidePanel",
    );
    assert.ok(slot, scheme);
    assert.equal(more.length, 0, scheme);
    const panel = one(slot, "fo-canvas-check-panel");
    assert.equal(label(one(panel, "fo-canvas-check-heading")), "Changes");
    assert.equal(label(one(panel, "fo-canvas-check-name")), "Mokly");
    // The catalogue has no new and no removed screen.
    assert.equal(
      label(one(panel, "fo-canvas-check-summary")),
      changed + " changed, 0 added, 0 removed.",
    );
    // The card's one way on is a link to the check, not a control that the
    // application would have to write.
    const links = elements(panel, (element) => element.tagName === "a");
    assert.deepEqual(
      links.map((link) => attribute(link, "href")),
      [pullRequest.github + "/checks"],
    );
    assert.equal(
      label(links[0]),
      pullRequest.number + " · " + pullRequest.title,
    );
    assert.equal(
      elements(panel, (element) =>
        /^firna-button-/.test(attribute(element, "data-testid") ?? ""),
      ).length,
      0,
    );
  }
});

test("a phone and a branch's ready viewer draw no check", () => {
  for (const scheme of ["light", "dark"] as const)
    assert.equal(
      byClass(page(pullRequestPath, "mobile", scheme), "fo-canvas-check-panel")
        .length,
      0,
      scheme,
    );
  for (const viewport of ["desktop", "mobile"] as const)
    assert.equal(
      byClass(
        page("product/viewer/standalone", viewport),
        "fo-canvas-check-panel",
      ).length,
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
