/**
 * The waits of the settings scope. While the settings dialog or layer reads
 * the workspace and the project of its address, the rail draws the sections
 * that the address's scope gives an owner, and the pane area draws the
 * requested pane's own wait, as `settings-dialog-states.md` says: the index
 * when the address names no pane, or the named pane with each text that the
 * scope supplies, such as the workspace's name, as a bar.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

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
  rowLinks,
  sectionHeadings,
  waitRegion,
} from "./drawn-page";
import { paneWaits } from "./settings-scope-wait-cases";

const viewports: readonly Viewport[] = ["desktop", "mobile"];

test("the settings index waits with every section and pane an owner sees", () => {
  for (const viewport of viewports) {
    const where = "product/settings/sections/loading " + viewport;
    const page = drawnPage("product/settings/sections/loading", viewport);
    const loaded = drawnPage("product/settings/sections", viewport);
    assert.deepEqual(
      pendingLabels(page),
      [["Loading settings…", "screen-reader-only"]],
      where,
    );
    const held = waitRegion(page, where);
    assert.deepEqual(
      sectionHeadings(held),
      ["You", "Workspace", "Project"],
      where,
    );
    // Each pane's name and summary are known, so they stay text; where each
    // row leads needs the scope, so no row is a link yet.
    assert.deepEqual(
      byClass(held, "content-list-row").map(label),
      byClass(loaded.main, "content-list-row").map(label),
      where,
    );
    assert.equal(rowLinks(loaded).length, 9, where);
    assert.deepEqual(rowLinks(page).map(destination), [], where);
    assert.equal(byClass(held, "fo-wait-text").length, 0, where);
  }
});

test("a pane asked for by its address waits with the scope's text as bars", () => {
  const id = "product/settings/members/scope-loading";
  for (const viewport of viewports) {
    const where = id + " " + viewport;
    const page = drawnPage(id, viewport);
    // The scope read is named once, for screen readers only.
    assert.deepEqual(
      pendingLabels(page),
      [["Loading settings…", "screen-reader-only"]],
      where,
    );
    const held = waitRegion(page, where);
    // The pane draws its own wait: the same rows, controls and field as while
    // it reads its members.
    const own = waitRegion(
      drawnPage("product/settings/members/loading", viewport),
      where,
    );
    assert.equal(placeholderRows(held).length, 2, where);
    assert.equal(
      placeholderRows(held).length,
      placeholderRows(own).length,
      where,
    );
    assert.deepEqual(
      buttonsIn(held).map(label),
      ["Manage", "Send invitation"],
      where,
    );
    assert.deepEqual(
      buttonsIn(held).map(label),
      buttonsIn(own).map(label),
      where,
    );
    assert.equal(byClass(held, "fo-wait-input").length, 1, where);
    // The scope supplies the workspace's name, so each heading that names it
    // keeps its known words beside a bar and waits hidden from assistive
    // technology, like every placeholder.
    assert.deepEqual(
      elements(held, (element) => element.tagName === "h2").map((title) => [
        label(title),
        attribute(title, "aria-hidden"),
        byClass(title, "fo-wait-text").length,
      ]),
      [
        ["People in", "true", 1],
        ["Invitations", undefined, 0],
        ["Invite to", "true", 1],
      ],
      where,
    );
    assert.deepEqual(sectionHeadings(held), ["", "Invitations", ""], where);
    assert.ok(!label(held).includes("Mokly"), where + " shows the workspace");
  }
  // The rail draws the sections that the address's scope gives an owner, with
  // the pane the address names as the current one.
  const rail = drawnPage(id, "desktop");
  assert.deepEqual(byClass(rail.main, "fo-group-label").map(label), [
    "You",
    "Workspace",
    "Project",
  ]);
  const panes = byClass(rail.main, "fo-nav-item");
  assert.deepEqual(panes.map(label), [
    "Account",
    "Workspace",
    "GitHub accounts",
    "Members",
    "Billing",
    "Project",
    "Publishing tokens",
    "Access",
    "Delete project",
  ]);
  assert.deepEqual(
    panes
      .filter((pane) => attribute(pane, "aria-current") === "page")
      .map(label),
    ["Members"],
  );
});

test("a pane that reads nothing of its own waits for the scope in its own layout", () => {
  for (const viewport of viewports)
    for (const entry of paneWaits) {
      const id = "product/settings/" + entry.pane + "/scope-loading";
      const where = id + " " + viewport;
      const page = drawnPage(id, viewport);
      const loaded = drawnPage("product/settings/" + entry.pane, viewport);
      // The scope read is named once, for screen readers only.
      assert.deepEqual(
        pendingLabels(page),
        [["Loading settings…", "screen-reader-only"]],
        where,
      );
      const held = waitRegion(page, where);
      // The pane's own layout: its headings and fact labels are those of the
      // loaded pane, with a bar where the scope supplies a text.
      assert.deepEqual(sectionHeadings(held), entry.headings, where);
      assert.equal(
        sectionHeadings(loaded.main).length,
        entry.headings.length,
        where,
      );
      assert.deepEqual(facts(page), entry.facts, where);
      assert.deepEqual(
        facts(loaded).map(([term]) => term),
        entry.facts.map(([term]) => term),
        where,
      );
      // Every control in the region draws its waiting form: a known label
      // draws itself disabled, a role-decided control is a placeholder, and
      // nothing leads anywhere.
      assert.deepEqual(
        controlStates(held),
        entry.disabled.map((name) => [name, true]),
        where,
      );
      assert.equal(
        byClass(held, "fo-wait-control").length,
        entry.placeholders,
        where,
      );
      assert.deepEqual(linksIn(held).map(label), [], where);
      assert.equal(placeholderRows(held).length, entry.frames, where);
      // The pane's one field waits in its own frame and holds nothing.
      const [field, ...more] = byClass(held, "fo-wait-input");
      assert.ok(field && more.length === 0, where + " waiting field");
      assert.deepEqual(
        elements(field, (element) => element.tagName === "input").map((input) =>
          attribute(input, "value"),
        ),
        [""],
        where,
      );
      for (const text of entry.shown)
        assert.ok(label(held).includes(text), where + " hides " + text);
      for (const text of entry.hidden)
        assert.ok(!label(held).includes(text), where + " shows " + text);
    }
  // The rail draws the sections that the address's scope gives an owner,
  // with the pane the address names as the current one.
  for (const entry of paneWaits) {
    const id = "product/settings/" + entry.pane + "/scope-loading";
    assert.deepEqual(currentPane(drawnPage(id, "desktop")), [entry.current]);
  }
});

test("a waiting label keeps its known words beside a bar for the scope's name", () => {
  for (const viewport of viewports) {
    const where = "product/settings/danger/scope-loading " + viewport;
    const held = waitRegion(
      drawnPage("product/settings/danger/scope-loading", viewport),
      where,
    );
    // The field is named by its label row, whose bar stands for the project.
    const [input] = elements(held, (element) => element.tagName === "input");
    const named = elements(
      held,
      (element) =>
        attribute(element, "id") === attribute(input, "aria-labelledby"),
    );
    assert.deepEqual(named.map(label), ["Type to confirm"], where);
    assert.equal(byClass(named[0], "fo-wait-text").length, 1, where);
    // The question keeps its known word beside a bar for the project's name.
    const [question] = elements(held, (element) => element.tagName === "h2");
    assert.deepEqual(
      [label(question), byClass(question, "fo-wait-text").length],
      ["Delete", 1],
      where,
    );
  }
});
