import assert from "node:assert/strict";
import test from "node:test";

import { changesLandingHref } from "../packages/viewer/dist/client/browse_landing.js";

import { asElement, FakeNode } from "./helpers/fake_dom.js";

const LIST_ID = "mb-nav-variants-pages-welcome";

/** One parent row, its disclosed variant list, and the catalogue filter. */
interface LandingFixture {
  all: FakeNode;
  changed: FakeNode;
  empty: FakeNode;
  error: FakeNode;
  list: FakeNode;
  parent: FakeNode;
  root: FakeNode;
}

test("Changes activation of an unmodified parent opens its changed variant", () => {
  const nav = landingFixture();

  assert.equal(
    changesLandingHref(asElement(nav.parent)),
    "/view/screens/welcome.variants/error.html",
  );
});

test("the landing skips a changed variant the filter keeps hidden", () => {
  const nav = landingFixture();
  nav.empty.setAttribute("data-changed", "true");
  nav.empty.hidden = true;

  assert.equal(
    changesLandingHref(asElement(nav.parent)),
    "/view/screens/welcome.variants/error.html",
  );
});

test("All keeps a parent activation on the parent screen", () => {
  const nav = landingFixture();
  nav.all.setAttribute("aria-pressed", "true");
  nav.changed.setAttribute("aria-pressed", "false");

  assert.equal(changesLandingHref(asElement(nav.parent)), undefined);
});

test("a parent that changed on its own stays the destination", () => {
  const nav = landingFixture();
  nav.parent.setAttribute("data-changed", "true");

  assert.equal(changesLandingHref(asElement(nav.parent)), undefined);
});

test("a parent with no visible variant row stays the destination", () => {
  const nav = landingFixture();
  nav.error.hidden = true;

  assert.equal(changesLandingHref(asElement(nav.parent)), undefined);
});

test("rows without the aggregate mark are never redirected", () => {
  const nav = landingFixture();
  nav.parent.removeAttribute("data-changed-variants");

  assert.equal(changesLandingHref(asElement(nav.parent)), undefined);
  assert.equal(changesLandingHref(asElement(nav.error)), undefined);
});

function landingFixture(): LandingFixture {
  const parent = navRow("screens/welcome.html", "Welcome");
  parent.setAttribute("data-changed-variants", "true");
  const empty = navRow("screens/welcome.variants/empty.html", "Empty");
  empty.hidden = true;
  const error = navRow("screens/welcome.variants/error.html", "Save failed");
  error.setAttribute("data-changed", "true");
  const toggle = new FakeNode("button", {
    "aria-controls": LIST_ID,
    "aria-expanded": "true",
    "data-nav-variants-toggle": LIST_ID,
  });
  const list = new FakeNode("div", {
    "data-nav-disclosure": "variants:pages:welcome",
    "data-nav-variants": "",
    id: LIST_ID,
  }).append(empty, error);
  const leaf = new FakeNode("div").append(parent, toggle);
  const all = filterOption("all", "false");
  const changed = filterOption("changed", "true");
  const root = new FakeNode("div").append(all, changed, leaf, list);
  return { all, changed, empty, error, list, parent, root };
}

function navRow(route: string, label: string): FakeNode {
  return new FakeNode(
    "a",
    { "data-nav-row": "", "data-route": route, href: `/view/${route}` },
    label,
  );
}

function filterOption(name: string, pressed: string): FakeNode {
  return new FakeNode("button", {
    "aria-pressed": pressed,
    "data-filter": name,
  });
}
