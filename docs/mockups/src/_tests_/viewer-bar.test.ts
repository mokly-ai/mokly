/**
 * The Canvas bar of the viewer drawings and its open account menu. The full
 * bar holds the project switcher, the publication pill, History, Share and
 * the account's avatar, and the compact bar the pill and More. The project
 * switcher is one control that leads with the workspace and keeps the whole
 * name; the pill's trigger keeps the reference as its own label, with the
 * state and the SHA outside it; the avatar's control keeps the reader's whole
 * name, with the initials outside it; History's clock and More's chevron are
 * their controls' own. Share is filled only where it is the screen's one
 * primary action. The menus that the avatar and More open are checked in
 * `viewer-account-menu.test.ts`, and the waits of the bar in
 * `viewer-waits.test.ts` and `viewer-reference-wait.test.ts`.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parse } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

import { sample } from "../fixtures/product";
import { denseViewerChrome } from "../fixtures/product-states";
import { publication } from "../fixtures/publications";

import { screenFile } from "./catalogue-paths";
import type { Scheme, Viewport } from "./catalogue-paths";
import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
import type { Element } from "./design-site-test-helpers";
import { destination } from "./drawn-page";

type Node = DefaultTreeAdapterMap["node"];

/** One whole drawn document, the bar in the package's slots included. */
function page(
  id: string,
  viewport: Viewport = "desktop",
  scheme: Scheme = "light",
): Node {
  return parse(readFileSync(screenFile(id, viewport, scheme), "utf8"));
}

/** The one element of a class inside a part, or a failure naming it. */
function one(node: Node, className: string): Element {
  const [found, ...more] = byClass(node, className);
  assert.ok(found, "no " + className);
  assert.equal(more.length, 0, "more than one " + className);
  return found;
}

/** The registered buttons inside one part, in document order. */
function buttonsIn(node: Node): Element[] {
  return elements(node, (element) =>
    /^firna-button-[a-z]+$/.test(attribute(element, "data-testid") ?? ""),
  );
}

/** Every link inside one part, in document order. */
function linksIn(node: Node): Element[] {
  return elements(node, (element) => element.tagName === "a");
}

const named = sample.workspace + " / " + sample.project;
const menuPath = "product/viewer/standalone/account-menu";

test("the full pill keeps the reference as its trigger's label and the state beside it", () => {
  const drawn = page("product/viewer/standalone");
  // Both bars draw their pill in the centre slot, and the compact bar leaves
  // its start slot empty, so its pill comes right after the package's mark.
  const compactness = (slot: Element) =>
    (attribute(slot, "class") ?? "")
      .split(/\s+/)
      .includes("fo-package-slot-compact");
  const centres = byClass(drawn, "fo-package-slot-center");
  const [fullCentre] = centres.filter((slot) => !compactness(slot));
  const [compactCentre] = centres.filter(compactness);
  assert.equal(centres.length, 2);
  assert.ok(fullCentre && compactCentre);
  assert.equal(
    byClass(drawn, "fo-package-slot-start").filter(compactness).length,
    0,
  );
  const full = one(fullCentre, "fo-canvas-pill");
  const compact = one(compactCentre, "fo-canvas-pill");
  assert.deepEqual(buttonsIn(full).map(label), [publication.branch]);
  const state = one(full, "fo-top-state");
  assert.equal(
    label(one(state, "fo-top-state-detail")),
    "Ready · " + publication.time.split(",")[0],
  );
  assert.equal(label(one(state, "mono-value")), publication.sha);
  assert.equal(buttonsIn(state).length, 0);
  // The compact pill names the branch's last segment and leaves the state out.
  assert.deepEqual(buttonsIn(compact).map(label), ["sydney-v1"]);
  assert.equal(byClass(compact, "fo-top-state").length, 0);
});

test("the avatar's control keeps the reader's whole name, and its initials stay outside it", () => {
  for (const [id, whole, initials] of [
    ["product/viewer/standalone", sample.viewer.name, sample.viewer.initials],
    ["product/viewer/standalone/account", denseViewerChrome.email, undefined],
  ] as const) {
    const account = one(page(id), "fo-canvas-account");
    const [control, ...more] = buttonsIn(account);
    assert.ok(control, id);
    assert.equal(more.length, 0, id);
    assert.equal(attribute(control, "aria-label"), whole, id);
    assert.equal(attribute(account, "title"), whole, id);
    const avatar = one(account, "fo-canvas-avatar");
    assert.equal(attribute(avatar, "aria-hidden"), "true", id);
    assert.match(label(avatar), /^[A-Z]{1,2}$/, id);
    if (initials) assert.equal(label(avatar), initials, id);
    assert.equal(byClass(control, "fo-canvas-avatar").length, 0, id);
  }
});

test("the project switcher is one control that leads with the workspace, and History and More draw their glyphs inside their controls", () => {
  const svg = (node: Element) => node.tagName === "svg";
  for (const id of [
    "product/viewer/standalone",
    "product/viewer/standalone/empty",
  ]) {
    const drawn = page(id);
    // The one control reads as the whole name, is named by it and holds it
    // as its wrapper's tooltip, with the switcher's chevron inside it.
    const project = one(drawn, "fo-top-project");
    const [control, ...more] = buttonsIn(project);
    assert.ok(control, id);
    assert.equal(more.length, 0, id);
    assert.equal(label(control), named, id);
    assert.equal(attribute(control, "aria-label"), named, id);
    assert.equal(
      attribute(one(project, "fo-top-variable-control"), "title"),
      named,
      id,
    );
    assert.equal(elements(control, svg).length, 1, id);
    // History's clock and More's chevron are the registered Button's own.
    for (const name of ["History", "More"]) {
      const [button, ...others] = buttonsIn(drawn).filter(
        (candidate) => label(candidate) === name,
      );
      assert.ok(button, id + " " + name);
      assert.equal(others.length, 0, id + " " + name);
      assert.equal(elements(button, svg).length, 1, id + " " + name);
    }
  }
});

test("Share is filled only where it is the screen's one primary action", () => {
  const share = (id: string) =>
    elements(
      page(id),
      (element) =>
        /^firna-button-/.test(attribute(element, "data-testid") ?? "") &&
        label(element) === "Share",
    ).map((element) => attribute(element, "data-testid"));
  // The ready viewer, a panel open over it, and the cloud's own bar.
  assert.deepEqual(share("product/viewer/standalone"), [
    "firna-button-primary",
  ]);
  assert.deepEqual(share("product/viewer/share"), ["firna-button-secondary"]);
  assert.deepEqual(share("product/viewer/standalone/empty"), [
    "firna-button-secondary",
  ]);
});

test("the cloud's bar leads each control to its screen and draws no Settings", () => {
  const bar = one(page("product/viewer/standalone/empty"), "fo-top-bar");
  // The project's control is named by the whole name it shows.
  const [project] = linksIn(bar);
  assert.ok(project);
  assert.equal(attribute(project, "aria-label"), named);
  // History draws its label, or its glyph alone named by it, each a link,
  // and the glyph's holder around the link gives the name as its tooltip.
  const glyph = linksIn(bar).find((link) => label(link) === "");
  assert.ok(glyph && glyph.parentNode && "tagName" in glyph.parentNode);
  assert.equal(attribute(glyph.parentNode, "title"), "History");
  assert.deepEqual(
    linksIn(bar).map((link) => [
      label(link) || attribute(link, "aria-label"),
      destination(link),
    ]),
    [
      [named, "product/viewer/projects"],
      [publication.branch, "product/viewer/switcher"],
      ["sydney-v1", "product/viewer/switcher"],
      ["History", "product/viewer/history"],
      ["History", "product/viewer/history"],
      ["Share", "product/viewer/share"],
      [sample.viewer.name, menuPath],
      ["More", menuPath],
    ],
  );
  for (const id of [
    "product/viewer/standalone",
    "product/viewer/standalone/empty",
  ])
    for (const viewport of ["desktop", "mobile"] as const)
      assert.equal(
        buttonsIn(page(id, viewport)).some(
          (button) => label(button) === "Settings",
        ),
        false,
        id + " " + viewport,
      );
});
