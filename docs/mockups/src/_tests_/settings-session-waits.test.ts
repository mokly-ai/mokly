/**
 * The settings waits before the scope is read. While the session read runs,
 * a settings surface asked for by its address draws the requested pane's
 * wait, as `folio-chrome.md` asks of every read a screen waits for, with each
 * text that the session supplies in its placeholder form. A durable route on
 * a wide surface draws the same wait until it hands over to the dialog over
 * the page beneath; the Billing pane, which Stripe returns to, draws it, with
 * each pane that the route has no address for disabled in the rail.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { billing, profile } from "../fixtures/product-states";
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
  currentPane,
  destination,
  drawnPage,
  facts,
  linksIn,
  pendingLabels,
  placeholderRows,
  sectionHeadings,
  waitRegion,
} from "./drawn-page";

const viewports: readonly Viewport[] = ["desktop", "mobile"];

test("the Account pane waits for the session with its texts in their placeholder forms", () => {
  const id = "product/settings/account/session-loading";
  for (const viewport of viewports) {
    const where = id + " " + viewport;
    const page = drawnPage(id, viewport);
    const loaded = drawnPage("product/settings/account", viewport);
    // The wait is named once, for screen readers only.
    assert.deepEqual(
      pendingLabels(page),
      [["Loading settings…", "screen-reader-only"]],
      where,
    );
    const held = waitRegion(page, where);
    // The pane's own layout: its headings and its fact's label, with a bar
    // where the session supplies the email.
    assert.deepEqual(sectionHeadings(held), ["GitHub", "Session"], where);
    assert.deepEqual(sectionHeadings(loaded.main), ["GitHub", "Session"]);
    assert.deepEqual(facts(page), [["Email", ""]], where);
    // The controls whose labels are known draw themselves disabled. The
    // GitHub connection waits in its note's own frame: its account as a bar,
    // and its status and its control, which the session decides, as
    // placeholders.
    assert.deepEqual(
      controlStates(held),
      [
        ["Save changes", true],
        ["Sign out", true],
      ],
      where,
    );
    assert.equal(byClass(held, "fo-wait-control").length, 2, where);
    assert.equal(placeholderRows(held).length, 1, where);
    assert.deepEqual(linksIn(held).map(label), [], where);
    // The name waits in its own frame and holds nothing.
    const [field, ...more] = byClass(held, "fo-wait-input");
    assert.ok(field && more.length === 0, where + " waiting field");
    assert.deepEqual(
      elements(field, (element) => element.tagName === "input").map((input) =>
        attribute(input, "value"),
      ),
      [""],
      where,
    );
    for (const text of [
      profile.email,
      profile.github,
      "Connected",
      "Connect GitHub",
      "Disconnect GitHub",
    ])
      assert.ok(!label(held).includes(text), where + " shows " + text);
  }
  assert.deepEqual(currentPane(drawnPage(id, "desktop")), ["Account"]);
});

test("the Billing pane waits for settings with its own read's facts and the plan as a bar", () => {
  const id = "product/settings/billing/scope-loading";
  for (const viewport of viewports) {
    const where = id + " " + viewport;
    const page = drawnPage(id, viewport);
    const own = drawnPage("product/settings/billing/loading", viewport);
    // The pane's own read, which names itself in the plan's place, has not
    // started, so the wait is named for screen readers only.
    assert.deepEqual(
      pendingLabels(page),
      [["Loading settings…", "screen-reader-only"]],
      where,
    );
    const held = waitRegion(page, where);
    // The layout of the pane's own read, with a bar in the plan's place too.
    assert.deepEqual(
      facts(page),
      facts(own).map(([term]) => [term, ""]),
      where,
    );
    assert.deepEqual(
      facts(page).map(([term]) => term),
      ["Plan", "Editors", "Collaborators", "Monthly total", "Renews"],
      where,
    );
    assert.equal(byClass(held, "fo-wait-control").length, 1, where);
    assert.equal(
      byClass(waitRegion(own, where), "fo-wait-control").length,
      1,
      where,
    );
    assert.deepEqual(buttonsIn(held).map(label), [], where);
    assert.deepEqual(linksIn(held).map(label), [], where);
    for (const text of [billing.plan, billing.total, billing.renews])
      assert.ok(!label(held).includes(text), where + " shows " + text);
  }
  assert.deepEqual(currentPane(drawnPage(id, "desktop")), ["Billing"]);
});

test("the Billing route's wait draws each pane it has no address for disabled, with no link", () => {
  const id = "product/settings/billing/route-loading";
  for (const viewport of viewports) {
    const where = id + " " + viewport;
    const page = drawnPage(id, viewport);
    const scoped = drawnPage(
      "product/settings/billing/scope-loading",
      viewport,
    );
    // The pane draws the dialog's own wait, named for screen readers only.
    assert.deepEqual(
      pendingLabels(page),
      [["Loading settings…", "screen-reader-only"]],
      where,
    );
    assert.deepEqual(facts(page), facts(scoped), where);
    assert.equal(
      byClass(waitRegion(page, where), "fo-wait-control").length,
      1,
      where,
    );
  }
  // The route's address names its workspace and no project. So each Project
  // pane draws itself, disabled, with no link, and every other pane leads to
  // its own drawing.
  const entries = byClass(drawnPage(id, "desktop").main, "fo-nav-item").map(
    (entry) => [
      label(entry),
      attribute(entry, "aria-disabled") ?? "",
      destination(entry) ?? attribute(entry, "href") ?? "",
    ],
  );
  assert.deepEqual(entries, [
    ["Account", "", "product/settings/account"],
    ["Workspace", "", "product/settings/workspace"],
    ["GitHub accounts", "", "product/settings/github"],
    ["Members", "", "product/settings/members"],
    ["Billing", "", "product/settings/billing"],
    ["Project", "true", ""],
    ["Publishing tokens", "true", ""],
    ["Access", "true", ""],
    ["Delete project", "true", ""],
  ]);
  assert.deepEqual(currentPane(drawnPage(id, "desktop")), ["Billing"]);
});
