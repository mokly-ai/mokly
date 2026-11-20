/**
 * The Canvas bar of the viewer drawings and its open account menu. The full
 * bar holds the project switcher, the publication pill, History, Share and
 * the account's avatar, and the compact bar the pill and More. The pill's
 * trigger keeps the reference as its own label, with the state and the SHA
 * outside it; the avatar's control keeps the reader's whole name, with the
 * initials outside it. Share is filled only where it is the screen's one
 * primary action. `product/viewer/standalone/account-menu` draws the account
 * menu and More. The waits of the bar are in `viewer-waits.test.ts` and
 * `viewer-reference-wait.test.ts`.
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

/** Every element with this role and, when given, this name. */
function roles(node: Node, role: string, name?: string) {
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

const named = sample.workspace + " / " + sample.project;
const menuPath = "product/viewer/standalone/account-menu";

test("the full pill keeps the reference as its trigger's label and the state beside it", () => {
  const drawn = page("product/viewer/standalone");
  const [full, compact] = byClass(drawn, "fo-canvas-pill");
  assert.ok(full && compact);
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
  assert.deepEqual(
    linksIn(bar).map((link) => [label(link), destination(link)]),
    [
      [named, "product/viewer/projects"],
      [publication.branch, "product/viewer/switcher"],
      ["sydney-v1", "product/viewer/switcher"],
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

test("the account menu opens under the avatar, and More under its trigger", () => {
  for (const scheme of ["light", "dark"] as const) {
    const drawn = page(menuPath, "desktop", scheme);
    const [account, more] = byClass(drawn, "fo-canvas-menu-layer");
    assert.ok(account && more);
    assert.ok((attribute(account, "class") ?? "").includes("fo-full-bar-only"));
    assert.ok((attribute(more, "class") ?? "").includes("fo-compact-bar-only"));
    const [menu] = roles(account, "dialog", "Account");
    assert.ok(menu, scheme);
    assert.deepEqual(
      roles(menu, "menu").map((list) => items(list)),
      [["Settings", "Sign out"]],
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
      [
        [named, "History", "Share"],
        ["Settings", "Sign out"],
      ],
    );
    assert.equal(roles(compact, "radiogroup", "Theme").length, 1, scheme);
  }
});

test("a phone opens More as a bottom sheet over the inert viewer", () => {
  const drawn = page(menuPath, "mobile");
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
    [
      [named, "History", "Share"],
      ["Settings", "Sign out"],
    ],
  );
  // The catalogue links below the artboard lead where the menu's rows go:
  // Settings to the settings index, because it names no pane, and Sign out
  // to sign-in. The last link shows the dialog's look over the viewer.
  assert.deepEqual(linksIn(one(drawn, "catalogue-links")).map(destination), [
    "product/settings/sections",
    "product/account/sign-in",
    "product/viewer/standalone/settings",
  ]);
});
