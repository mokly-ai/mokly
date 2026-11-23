/**
 * The open menus of `product/viewer/standalone/account-menu`: the account menu
 * under the full bar's avatar, More under the compact bar's trigger, and More
 * as a phone's bottom sheet. Each menu ends with the same account rows: who is
 * signed in and Theme, then Settings, Docs, Changelog and Sign out. Docs and
 * Changelog leave the app for the site, so each draws the external glyph in
 * place of a glyph of its own. The bar that opens the menus is checked in
 * `viewer-bar.test.ts`.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parse, parseFragment } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { sample } from "../fixtures/product";
import { Icon } from "../screens/product/icons";
import type { IconName } from "../screens/product/icons";

import { screenFile } from "./catalogue-paths";
import type { Scheme, Viewport } from "./catalogue-paths";
import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
import type { Element } from "./design-site-test-helpers";
import { destination, linksIn } from "./drawn-page";

type Node = DefaultTreeAdapterMap["node"];

const menuPath = "product/viewer/standalone/account-menu";
const named = sample.workspace + " / " + sample.project;

/** The items of the account rows, in their order, in every menu. */
const accountItems = ["Settings", "Docs", "Changelog", "Sign out"];

/** One whole drawn view of the menus' page, the bar included. */
function page(viewport: Viewport, scheme: Scheme = "light"): Node {
  return parse(readFileSync(screenFile(menuPath, viewport, scheme), "utf8"));
}

/** The one element of a class inside a part, or a failure naming it. */
function one(node: Node, className: string): Element {
  const [found, ...more] = byClass(node, className);
  assert.ok(found, "no " + className);
  assert.equal(more.length, 0, "more than one " + className);
  return found;
}

/** Every element with this role and, when given, this name. */
function roles(node: Node, role: string, name?: string): Element[] {
  return elements(
    node,
    (element) =>
      attribute(element, "role") === role &&
      (name === undefined || attribute(element, "aria-label") === name),
  );
}

/** The labels of a menu's items. */
function items(menu: Element): string[] {
  return roles(menu, "menuitem").map(label);
}

/** The outlines that a part's glyphs draw, which tell one shape from another. */
function outlines(node: Node): string[] {
  return elements(node, (element) => element.tagName === "path").map(
    (path) => attribute(path, "d") ?? "",
  );
}

/** The outlines of one glyph of the product's icon set. */
function iconOutlines(name: IconName): string[] {
  return outlines(
    parseFragment(renderToStaticMarkup(createElement(Icon, { name }))),
  );
}

test("the account menu opens under the avatar, and More under its trigger", () => {
  for (const scheme of ["light", "dark"] as const) {
    const drawn = page("desktop", scheme);
    const [account, more] = byClass(drawn, "fo-canvas-menu-layer");
    assert.ok(account && more);
    assert.ok((attribute(account, "class") ?? "").includes("fo-full-bar-only"));
    assert.ok((attribute(more, "class") ?? "").includes("fo-compact-bar-only"));
    const [menu] = roles(account, "dialog", "Account");
    assert.ok(menu, scheme);
    assert.deepEqual(
      roles(menu, "menu").map((list) => items(list)),
      [accountItems],
    );
    assert.equal(label(one(menu, "fo-canvas-menu-name")), sample.viewer.name);
    assert.equal(label(one(menu, "fo-canvas-menu-email")), sample.viewer.email);
    // The Theme choice selects the document's own scheme.
    const [theme] = roles(menu, "radiogroup", "Theme");
    assert.ok(theme, scheme);
    assert.deepEqual(
      roles(theme, "radio").map((radio) => [
        attribute(radio, "aria-label"),
        attribute(radio, "aria-checked"),
      ]),
      [
        ["Light", String(scheme === "light")],
        ["Dark", String(scheme === "dark")],
      ],
    );
    // More carries the project, History and Share, then the same account
    // rows, and no Search.
    const [compact] = roles(more, "dialog", "More");
    assert.ok(compact, scheme);
    assert.deepEqual(
      roles(compact, "menu").map((list) => items(list)),
      [[named, "History", "Share"], accountItems],
    );
    assert.equal(roles(compact, "radiogroup", "Theme").length, 1, scheme);
  }
});

test("a phone opens More as a bottom sheet over the inert viewer", () => {
  const drawn = page("mobile");
  const backdrop = one(drawn, "fo-viewer-backdrop");
  assert.equal(attribute(backdrop, "aria-hidden"), "true");
  assert.equal(attribute(backdrop, "inert"), "");
  const [sheet, ...others] = roles(drawn, "dialog", "More");
  assert.ok(sheet);
  assert.equal(others.length, 0);
  assert.equal(attribute(sheet, "aria-modal"), "true");
  assert.deepEqual(
    elements(drawn, (element) => element.tagName === "h1").map(label),
    ["More"],
  );
  assert.deepEqual(
    roles(sheet, "menu").map((list) => items(list)),
    [[named, "History", "Share"], accountItems],
  );
  // The catalogue links below the artboard lead where the menu's items go, in
  // their order: Settings to the settings index, because it names no pane,
  // Docs and Changelog to the site's pages, and Sign out to sign-in. The last
  // link shows the dialog's look over the viewer.
  assert.deepEqual(linksIn(one(drawn, "catalogue-links")).map(destination), [
    "product/settings/sections",
    "design/site/docs",
    "design/site/changelog",
    "product/account/sign-in",
    "product/viewer/standalone/settings",
  ]);
});

test("Docs and Changelog draw the external glyph in place of a glyph of their own", () => {
  const glyphs: Record<string, string[]> = {
    Settings: iconOutlines("settings"),
    Docs: iconOutlines("external"),
    Changelog: iconOutlines("external"),
    "Sign out": iconOutlines("signOut"),
  };
  for (const viewport of ["desktop", "mobile"] as const)
    for (const scheme of ["light", "dark"] as const) {
      const where = viewport + " " + scheme;
      // A desktop view draws the account menu and More, and a phone More.
      const menus = roles(page(viewport, scheme), "menu", "Account");
      assert.equal(menus.length, viewport === "desktop" ? 2 : 1, where);
      for (const menu of menus)
        assert.deepEqual(
          roles(menu, "menuitem").map((row) => [label(row), outlines(row)]),
          accountItems.map((item) => [item, glyphs[item]]),
          where,
        );
    }
});
