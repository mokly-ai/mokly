import assert from "node:assert/strict";
import { test } from "node:test";

import { openSource } from "../fixtures/site";

import {
  attribute,
  byClass,
  elements,
  label,
  siteDocument,
  siteStyles,
} from "./design-site-test-helpers";
import { siteScreens } from "./site-stylesheets";

/** The control that opens the menu, read from one header. */
function menuControl(id: string, viewport: "mobile" | "desktop") {
  const { document } = siteDocument(id, viewport);
  const header = byClass(document, "site-header")[0];
  assert.ok(header, id);
  const controls = byClass(header, "site-menu-button");
  assert.equal(controls.length, 1, `${id} ${viewport}: one menu control`);
  return { control: controls[0]!, document };
}

test("every header draws the closed menu control and no open menu", () => {
  for (const viewport of ["mobile", "desktop"] as const)
    for (const id of siteScreens) {
      const { control, document } = menuControl(id, viewport);
      assert.equal(control.tagName, "button");
      assert.equal(attribute(control, "aria-label"), "Menu");
      assert.equal(attribute(control, "aria-expanded"), "false");
      assert.equal(attribute(control, "aria-haspopup"), "dialog");
      assert.equal(attribute(control, "aria-controls"), "site-menu");
      assert.equal(byClass(document, "site-menu").length, 0, id);
      assert.equal(byClass(document, "site-menu-scrim").length, 0, id);
    }
});

test("the open menu lists the destinations over the mobile home", () => {
  const { control, document } = menuControl("design/site/home/menu", "mobile");
  assert.equal(attribute(control, "aria-expanded"), "true");
  const menus = byClass(document, "site-menu");
  assert.equal(menus.length, 1);
  const menu = menus[0]!;
  assert.equal(menu.tagName, "dialog");
  assert.equal(attribute(menu, "id"), "site-menu");
  assert.equal(attribute(menu, "aria-label"), "Menu");
  assert.notEqual(attribute(menu, "open"), undefined);
  const scrim = byClass(document, "site-menu-scrim");
  assert.equal(scrim.length, 1);
  assert.equal(attribute(scrim[0]!, "aria-hidden"), "true");
  assert.deepEqual(
    byClass(menu, "site-menu-close").map((node) =>
      attribute(node, "aria-label"),
    ),
    ["Close menu"],
  );
  const links = elements(menu, (node) => node.tagName === "a");
  assert.deepEqual(links.map(label), [
    "Docs",
    "Changelog",
    "Pricing",
    "GitHub",
    "Get started →",
  ]);
  assert.deepEqual(
    links.map((node) => attribute(node, "data-mokly-link")),
    [
      "design/site/docs",
      "design/site/changelog",
      "design/site/pricing",
      undefined,
      "product/account/sign-up",
    ],
  );
  assert.equal(attribute(links[3]!, "href"), openSource.github);
  // The home is not one of the destinations, so none of them is current.
  assert.deepEqual(
    links.filter((node) => attribute(node, "aria-current")),
    [],
  );
  assert.equal(
    elements(menu, (node) => attribute(node, "type") === "radio").length,
    0,
    "the menu holds no scheme control",
  );
});

test("the desktop view of the open menu keeps the destinations in the row", () => {
  const { control, document } = menuControl("design/site/home/menu", "desktop");
  assert.equal(attribute(control, "aria-expanded"), "false");
  assert.equal(byClass(document, "site-menu").length, 0);
  assert.deepEqual(
    elements(
      byClass(document, "site-nav")[0]!,
      (node) => node.tagName === "a",
    ).map(label),
    ["Docs", "Changelog", "Pricing", "GitHub"],
  );
});

test("Get started stays in the tool bar beside the menu control", () => {
  for (const viewport of ["mobile", "desktop"] as const) {
    const { document } = siteDocument("design/site/home/menu", viewport);
    const header = byClass(document, "site-header")[0];
    assert.ok(header);
    const actions = elements(
      header,
      (node) =>
        node.tagName === "a" &&
        (attribute(node, "class") ?? "").includes("site-button--primary"),
    );
    assert.deepEqual(actions.map(label), ["Get started →"], viewport);
    assert.equal(
      attribute(actions[0]!, "data-mokly-link"),
      "product/account/sign-up",
      viewport,
    );
    assert.equal(
      byClass(byClass(document, "site-nav")[0]!, "site-button").length,
      0,
      `${viewport}: Get started sits outside the navigation, which the mobile tool bar hides`,
    );
  }
});

for (const id of siteScreens)
  test(`${id}: only the mobile composition draws the menu control`, () => {
    const css = siteStyles(id);
    assert.match(css, /\.site-menu-button \{\s*display: none;\s*\}/);
    assert.match(
      css,
      /\[data-site-viewport="mobile"\] \.site-menu-button \{\s*display: inline-flex;\s*\}/,
    );
    assert.match(
      css,
      /\[data-site-viewport="mobile"\] \.site-nav \{\s*display: none;\s*\}/,
    );
  });
