/**
 * The waits of the viewer's stage. Each read draws the layout that it waits
 * for, as the Wait composition in `folio-chrome.md` defines: a stage read
 * draws the stage's waiting card, the State card in its placeholder form with
 * the read named in its title, and the route's project read draws the cloud
 * frame, its bar's controls waiting, over that card, as one waiting region
 * whose heading names the read for screen readers. The old block of three
 * bars is gone. The panels' waits are in `viewer-panel-waits.test.ts`, and the
 * bar of a publication's address, whose reference trigger waits, is in
 * `viewer-reference-wait.test.ts`.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { sample, workspace } from "../fixtures/product";

import type { Viewport } from "./catalogue-paths";
import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
import {
  buttonsIn,
  controlStates,
  drawnPage,
  linksIn,
  only,
  pendingLabels,
} from "./drawn-page";

const viewports: readonly Viewport[] = ["desktop", "mobile"];

/** The desktop bar's project trigger while the workspace and project are known. */
const named = sample.workspace + " / " + sample.project;

/**
 * Each stage read: the drawing, the name its card's title shows, and what the
 * desktop bar's project trigger says, which the workspace read draws as the
 * workspace's address.
 */
const stageWaits = [
  {
    wait: "product/viewer/standalone/loading",
    name: "Loading publication…",
    project: named,
  },
  {
    wait: "product/viewer/standalone/publication-loading",
    name: "Loading publication…",
    project: named,
  },
  {
    wait: "product/viewer/pull-request/loading",
    name: "Loading publication…",
    project: named,
  },
  {
    wait: "product/viewer/standalone/catalogue/loading",
    name: "Opening the catalogue…",
    project: named,
  },
  {
    wait: "product/viewer/standalone/build/loading",
    name: "Loading build…",
    project: named,
  },
  {
    wait: "product/viewer/standalone/plan-loading",
    name: "Checking publishing access…",
    project: workspace.slug + " / " + sample.project,
  },
  {
    wait: "product/viewer/standalone/uploading",
    name: "Publishing this branch…",
    project: named,
  },
] as const;

/**
 * The route's project read: the drawing, and the name its heading gives the
 * read for screen readers, because the heading's own text, the project and
 * its publication, is the read's to give.
 */
const projectRead = {
  id: "product/viewer/standalone/project-loading",
  name: "Opening your project…",
} as const;

test("a stage read draws the stage's waiting card, titled with the read", () => {
  for (const viewport of viewports)
    for (const entry of stageWaits) {
      const where = entry.wait + " " + viewport;
      const page = drawnPage(entry.wait, viewport);
      // The read is named once, in the one text place the answer decides.
      assert.deepEqual(pendingLabels(page), [[entry.name, "visible"]], where);
      for (const old of ["fo-pending", "fo-pending-shape"])
        assert.equal(byClass(page.main, old).length, 0, where + " " + old);
      const canvas = only(page.main, "fo-stage-canvas");
      const region = only(only(canvas, "fo-stage-card"), "fo-wait");
      assert.equal(attribute(region, "aria-busy"), "true", where);
      // The State card in its placeholder form: its glyph tile, its line and
      // its action wait in their own places, and its title names the read.
      const card = only(region, "fo-wait-state");
      assert.equal(byClass(card, "fo-wait-glyph").length, 1, where);
      assert.deepEqual(
        byClass(card, "fo-state-title").map((title) => [
          title.tagName,
          label(title),
          byClass(title, "fo-pending-label").length,
        ]),
        [["h2", entry.name, 1]],
        where,
      );
      assert.equal(
        byClass(only(card, "fo-state-detail"), "fo-wait-text").length,
        1,
        where,
      );
      assert.equal(
        byClass(only(card, "fo-state-action"), "fo-wait-control").length,
        1,
        where,
      );
      // Nothing in the stage can be pressed or followed while it waits.
      assert.deepEqual(controlStates(canvas), [], where);
      assert.deepEqual(linksIn(canvas), [], where);
      if (viewport === "mobile") continue;
      // The trigger says the workspace, or its address, and the project, and
      // the whole of what it says names it.
      const project = only(only(page.main, "fo-top-bar"), "fo-top-project");
      assert.deepEqual(controlStates(project), [[entry.project, false]], where);
      assert.deepEqual(
        buttonsIn(project).map((button) => attribute(button, "aria-label")),
        [entry.project],
        where,
      );
    }
});

test("the project read draws the cloud frame with its bar's controls waiting", () => {
  const { id, name } = projectRead;
  // The loaded bar the frame stands for, while the publication is read.
  const loaded = only(
    drawnPage("product/viewer/standalone/loading").main,
    "fo-top-trail",
  );
  // History, Share and the account's avatar, whose control keeps the
  // reader's name; Settings lives in the account menu, not in the bar. A
  // desktop drawing draws the full bar and the compact bar for the switch in
  // `viewer-bar.css` to show one, so the bar's last group also holds the
  // compact bar's More.
  const trail = controlStates(loaded).map(([shown]) => shown);
  assert.deepEqual(trail, ["History", "Share", sample.viewer.name, "More"]);
  for (const [viewport, known] of [
    ["desktop", trail],
    ["mobile", ["More"]],
  ] as const) {
    const where = id + " " + viewport;
    const page = drawnPage(id, viewport);
    // The read is named once, for screen readers only.
    assert.deepEqual(
      pendingLabels(page),
      [[name, "screen-reader-only"]],
      where,
    );
    for (const old of ["fo-pending", "fo-pending-shape"])
      assert.equal(byClass(page.main, old).length, 0, where + " " + old);
    // The whole frame waits for the project: one region holds the heading,
    // the bar and the stage.
    const region = only(page.main, "fo-wait");
    assert.equal(attribute(region, "aria-busy"), "true", where);
    const bar = only(region, "fo-top-bar");
    // A control whose label is known draws itself, disabled; the triggers the
    // project names wait as placeholders over their own boxes.
    assert.deepEqual(
      controlStates(bar),
      known.map((shown) => [shown, true]),
      where,
    );
    assert.equal(
      byClass(bar, "fo-wait-control").length,
      viewport === "desktop" ? 2 : 1,
      where,
    );
    assert.deepEqual(linksIn(bar), [], where);
    if (viewport === "desktop")
      assert.deepEqual(controlStates(only(bar, "fo-top-project")), [], where);
    // The publication's state is the project's to tell: a dot and a bar.
    const state = only(bar, "fo-top-state");
    assert.equal(attribute(state, "aria-hidden"), "true", where);
    assert.equal(label(state), "", where);
    // The cloud draws only its slots: no package viewer and no package part.
    assert.equal(byClass(page.main, "mokly-viewer").length, 0, where);
    assert.equal(byClass(page.main, "mbk-brand").length, 0, where);
    // The stage's waiting card: its glyph tile, its line and its action wait
    // in their own places. The heading names the read, so the card's title
    // is a bar.
    const canvas = only(region, "fo-stage-canvas");
    const card = only(only(canvas, "fo-stage-card"), "fo-wait-state");
    assert.equal(byClass(card, "fo-wait-glyph").length, 1, where);
    assert.deepEqual(
      byClass(card, "fo-state-title").map((title) => [
        title.tagName,
        label(title),
        attribute(title, "aria-hidden"),
      ]),
      [["span", "", "true"]],
      where,
    );
    assert.equal(
      byClass(only(card, "fo-state-detail"), "fo-wait-text").length,
      1,
      where,
    );
    assert.equal(
      byClass(only(card, "fo-state-action"), "fo-wait-control").length,
      1,
      where,
    );
    // Nothing in the stage can be pressed or followed while it waits.
    assert.deepEqual(controlStates(canvas), [], where);
    assert.deepEqual(linksIn(canvas), [], where);
    // The heading names the project, which the read supplies, so it holds
    // the read's one name for screen readers. A status inside a heading would
    // leave the heading with no name, and no other part says the name.
    const headings = elements(region, (node) => node.tagName === "h1");
    assert.deepEqual(
      headings.map((heading) => [
        attribute(heading, "aria-hidden"),
        label(heading),
        byClass(heading, "fo-pending-label").map((held) =>
          attribute(held, "role"),
        ),
      ]),
      [[undefined, name, [undefined]]],
      where,
    );
    assert.equal(
      elements(page.main, (node) => node.tagName === "h1").length,
      1,
      where,
    );
    assert.equal(label(page.main).split(name).length - 1, 1, where);
  }
});

test("the build card's plan refusal waits for its reader on the owner's action", () => {
  for (const viewport of viewports) {
    const page = drawnPage(
      "product/viewer/standalone/build/reader/plan-loading",
      viewport,
    );
    const action = only(page.main, "fo-build-action");
    assert.deepEqual(
      pendingLabels(page),
      [["Checking publishing access…", "screen-reader-only"]],
      viewport,
    );
    assert.equal(byClass(action, "fo-pending-label").length, 1, viewport);
    assert.equal(byClass(action, "fo-wait-control").length, 1, viewport);
    // Nobody is offered an action before the read says who the reader is.
    assert.deepEqual(controlStates(only(page.main, "fo-build")), [], viewport);
  }
});
