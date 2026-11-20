/**
 * The workspace model's reads that run or fail beside what is already drawn:
 * the install step's suspension whose link could not be read, and the
 * Workspace pane's GitHub accounts fact while its own read runs and after it
 * failed. Each keeps the rest of its page; only the part the read supplies
 * changes.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { DefaultTreeAdapterMap } from "parse5";

import { appSource } from "./app-parity-reads";
import {
  attribute,
  byClass,
  childElements,
  elements,
  label,
} from "./design-site-test-helpers";
import { actions, destination, drawnPage, facts, links } from "./drawn-page";
import type { DrawnPage } from "./drawn-page";

type Element = DefaultTreeAdapterMap["element"];

const viewports = ["desktop", "mobile"] as const;

/** The value element of one read-only fact. */
function factValue(page: DrawnPage, term: string): Element {
  const value = byClass(page.main, "fo-facts")
    .flatMap((list) => childElements(list))
    .map((pair) => childElements(pair))
    .find(([name]) => name !== undefined && label(name) === term)?.[1];
  assert.ok(value, "no fact " + term);
  return value;
}

test("a suspension whose link could not be read says so and keeps the step's action", () => {
  for (const viewport of viewports) {
    const page = drawnPage(
      "product/account/install-app/suspended-unreadable",
      viewport,
    );
    assert.deepEqual(facts(page), [["App", "SuspendedCouldn’t loadTry again"]]);
    assert.deepEqual(links(page, "Resume on GitHub"), []);
    assert.deepEqual(actions(page).slice(0, 2), [
      ["quiet", "Try again"],
      ["primary", "Install on GitHub"],
    ]);
    // Reading again is the suspension page, where the link is.
    assert.deepEqual(links(page, "Try again").map(destination), [
      "product/account/install-app/error",
    ]);
    assert.ok(page.html.includes("Publish with the CLI instead"), viewport);
  }
});

test("a suspension whose link is being read holds the link's place and keeps the step's action", () => {
  for (const viewport of viewports) {
    const page = drawnPage(
      "product/account/install-app/suspended-loading",
      viewport,
    );
    assert.deepEqual(facts(page), [["App", "Suspended"]]);
    assert.deepEqual(links(page, "Resume on GitHub"), []);
    // Only the link waits, so only the fact is the waiting region, and the
    // link's own box holds one bar.
    const [region, ...more] = byClass(page.main, "fo-wait");
    assert.equal(more.length, 0, viewport);
    assert.equal(attribute(region, "aria-busy"), "true", viewport);
    assert.equal(byClass(region, "fo-facts").length, 1, viewport);
    const value = factValue(page, "App");
    assert.equal(
      byClass(value, "fo-site-link").flatMap((link) =>
        byClass(link, "fo-wait-text"),
      ).length,
      1,
      viewport,
    );
    assert.deepEqual(
      byClass(page.main, "fo-pending-label").map((name) => [
        label(name),
        attribute(name, "class"),
      ]),
      [["Loading GitHub installation…", "fo-pending-label fo-sr-only"]],
    );
    assert.deepEqual(actions(page), [["primary", "Install on GitHub"]]);
    assert.ok(page.html.includes("Publish with the CLI instead"), viewport);
  }
});

test("the GitHub accounts fact holds its place while its read runs", () => {
  for (const viewport of viewports) {
    const page = drawnPage(
      "product/settings/workspace/accounts-loading",
      viewport,
    );
    const value = factValue(page, "GitHub accounts");
    assert.equal(label(value), "Loading GitHub accountsManage");
    assert.deepEqual(byClass(value, "fo-sr-only").map(label), [
      "Loading GitHub accounts",
    ]);
    const placeholder = elements(
      value,
      (element) =>
        attribute(element, "aria-hidden") === "true" &&
        (attribute(element, "style") ?? "").includes("width:96px"),
    );
    assert.equal(placeholder.length, 1, viewport);
  }
  // The app's fact draws the same placeholder under the same name.
  assert.match(
    appSource("settings/panes/workspace-github.tsx"),
    /<span className="fo-sr-only">Loading GitHub accounts<\/span>\s*<SkeletonBar width=\{96\} height=\{14\} \/>/,
  );
});

test("a failed read of the GitHub accounts offers it again and keeps the pane", () => {
  for (const viewport of viewports) {
    const page = drawnPage(
      "product/settings/workspace/accounts-unreadable",
      viewport,
    );
    const value = factValue(page, "GitHub accounts");
    assert.equal(label(value), "Couldn’t loadTry againManage");
    assert.deepEqual(links(page, "Try again").map(destination), [
      "product/settings/workspace",
    ]);
    // A failed read is a state of the fact, not of the pane: no state body
    // and no write failure stand in for the pane.
    assert.equal(byClass(page.main, "fo-state-title").length, 0, viewport);
    assert.ok(!page.html.includes("fo-write-failure"), viewport);
    assert.ok(page.html.includes("Workspace name"), viewport);
  }
});
