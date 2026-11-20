/**
 * The waits of the onboarding steps. Each read draws its step's own layout,
 * as the Wait composition in `folio-chrome.md` defines: known text stays, each
 * part the answer supplies draws its waiting form in its own place, and the
 * operation is named once, in the text place whose text the answer decides or
 * for screen readers only. The address suggestion names its read in the
 * address line, in place of the address.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { billing, onboarding } from "../fixtures/product-states";

import { screenFile } from "./catalogue-paths";
import type { Viewport } from "./catalogue-paths";
import {
  attribute,
  byClass,
  childElements,
  elements,
  label,
} from "./design-site-test-helpers";
import type { Element } from "./design-site-test-helpers";
import {
  actions,
  destination,
  drawnPage,
  links,
  pendingLabels,
  stepsDone,
} from "./drawn-page";
import type { DrawnPage } from "./drawn-page";
import { waits } from "./onboarding-wait-cases";
import { inventoryPages } from "./product-inventory";

const viewports: readonly Viewport[] = ["desktop", "mobile"];

export const cli = "Publish with the CLI instead";

/** The one element of a class that the test needs, or a failure naming it. */
function only(node: DrawnPage["main"] | Element, className: string): Element {
  const [found, ...more] = byClass(node, className);
  assert.ok(found, "no " + className);
  assert.equal(more.length, 0, "more than one " + className);
  return found;
}

/** The first class of each part of a body, in order: the layout it draws. */
function shape(body: Element): string[] {
  return childElements(body).map(
    (part) => (attribute(part, "class") ?? part.tagName).split(/\s+/)[0],
  );
}

/** The page's one heading. */
export function heading(page: DrawnPage): Element {
  const [found, ...more] = elements(
    page.main,
    (element) => element.tagName === "h1",
  );
  assert.ok(found, "no heading");
  assert.equal(more.length, 0, "more than one heading");
  return found;
}

/** Each field's label, in order, whether it is loaded or waiting. */
function fieldLabels(page: DrawnPage): string[] {
  return elements(page.main, (element) =>
    ["firna-input", "firna-selector"].includes(
      attribute(element, "data-testid") ?? "",
    ),
  ).map((field) => {
    const by = attribute(field, "aria-labelledby");
    const [named] = by
      ? elements(page.main, (element) => attribute(element, "id") === by)
      : byClass(field, "firna-text");
    return named ? label(named) : "";
  });
}

test("an onboarding wait draws its step's own layout and names its read once", () => {
  for (const viewport of viewports)
    for (const entry of waits) {
      const where = entry.wait + " " + viewport;
      const page = drawnPage(entry.wait, viewport);
      const loaded = drawnPage(entry.loaded, viewport);
      assert.deepEqual(pendingLabels(page), [entry.heard], where);
      const region = only(page.main, "fo-wait");
      assert.equal(attribute(region, "aria-busy"), "true", where);
      // The same parts in the same places, each field in its waiting form,
      // and each control either itself or its placeholder in its own box.
      const body = only(region, "fo-account-body");
      assert.deepEqual(
        shape(body),
        shape(only(loaded.main, "fo-account-body")),
        where,
      );
      assert.deepEqual(fieldLabels(page), fieldLabels(loaded), where);
      assert.equal(
        byClass(body, "fo-wait-input").length +
          byClass(body, "fo-wait-field").length,
        fieldLabels(page).length,
        where,
      );
      assert.equal(
        actions(page).length + byClass(body, "fo-wait-control").length,
        actions(loaded).length,
        where,
      );
      if (entry.place)
        assert.equal(
          byClass(only(region, entry.place), "fo-pending-label").length,
          1,
          where + " names its read in " + entry.place,
        );
      // A known heading stays. One the answer decides holds a bar, hidden
      // like every placeholder, and the read's one name for screen readers,
      // so it stays the screen's one heading and names the read.
      const title = heading(page);
      if (entry.heading === "known")
        assert.equal(label(title), label(heading(loaded)), where);
      else {
        assert.equal(attribute(title, "aria-hidden"), undefined, where);
        const bar = only(title, "fo-wait-text");
        assert.equal(attribute(bar, "aria-hidden"), "true", where);
        // A status inside a heading would leave the heading with no name.
        const name = only(title, "fo-pending-label");
        assert.equal(attribute(name, "role"), undefined, where);
        assert.equal(label(title), entry.heard[0], where);
      }
      assert.equal(stepsDone(page), entry.steps, where);
      // The line to the CLI form needs the workspace to lead anywhere.
      assert.deepEqual(links(page, cli), [], where);
      assert.deepEqual(
        byClass(page.main, "fo-account-switch-text").map(label),
        entry.cli ? [cli] : [],
        where,
      );
      for (const value of entry.hidden)
        assert.ok(!label(region).includes(value), where + " shows " + value);
    }
});

test("a step waiting for its workspace keeps the ways back it knows", () => {
  for (const viewport of viewports) {
    for (const [id, back] of [
      [
        "product/account/install-app/loading",
        "product/account/create-workspace",
      ],
      [
        "product/account/choose-repository/cli/workspace-loading",
        "product/account/choose-repository",
      ],
    ] as const)
      assert.deepEqual(
        links(drawnPage(id, viewport), "Back").map(destination),
        [back],
        id + " " + viewport,
      );
    // Create project's label is known, so it draws itself, disabled.
    for (const id of [
      "product/account/choose-repository/loading",
      "product/account/choose-repository/cli/workspace-loading",
    ]) {
      const page = drawnPage(id, viewport);
      assert.deepEqual(actions(page), [["primary", "Create project"]], id);
      const [create] = elements(
        page.main,
        (element) =>
          attribute(element, "data-testid") === "firna-button-primary",
      );
      assert.equal(attribute(create, "aria-disabled"), "true", id);
      assert.deepEqual(links(page, "Create project"), [], id);
      assert.ok(page.html.includes(billing.publicProjects), id);
    }
  }
});

test("pending address suggestions retain the populated owning forms", () => {
  for (const [id, retained, canonical] of [
    [
      "product/account/create-workspace/suggestion-loading",
      [onboarding.workspace, onboarding.workspaceSlug],
      "product/account/create-workspace",
    ],
    [
      "product/account/choose-repository/suggestion-loading",
      ["mokly-ai/mokly-cloud", onboarding.projectSlug],
      "product/account/choose-repository",
    ],
  ] as const) {
    const page = inventoryPages().find((entry) => entry.path === id);
    assert.ok(page, id);
    const html = readFileSync(screenFile(page.path, "desktop"), "utf8");
    assert.ok(html.includes("Finding an available address"), id);
    assert.ok(html.includes('aria-busy="true"'), id);
    for (const value of retained)
      assert.ok(html.includes(value), id + " " + value);
    // The address line says it, in place of the address, and the form
    // inserts nothing: the waiting region is the line itself.
    for (const viewport of viewports) {
      const where = id + " " + viewport;
      const drawn = drawnPage(id, viewport);
      assert.deepEqual(
        pendingLabels(drawn),
        [["Finding an available address…", "visible"]],
        where,
      );
      const line = only(drawn.main, "fo-address-preview");
      assert.equal(byClass(line, "fo-pending-label").length, 1, where);
      assert.equal(elements(line, (node) => node.tagName === "code").length, 0);
      const held = childElements(only(drawn.main, "fo-wait"));
      assert.equal(held.length, 1, where);
      assert.equal(held[0], line, where);
      assert.equal(
        childElements(only(drawn.main, "fo-account-body")).length,
        childElements(
          only(drawnPage(canonical, viewport).main, "fo-account-body"),
        ).length,
        where,
      );
    }
  }
});
