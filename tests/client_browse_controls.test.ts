import assert from "node:assert/strict";
import test from "node:test";

import { handleBrowseControl } from "../packages/viewer/dist/client/browse_controls.js";
import {
  isDisclosureOpen,
  setDisclosureOpen,
} from "../packages/viewer/dist/client/disclosures.js";

import { asDocument, asElement, FakeNode } from "./helpers/fake_dom.js";

const LIST_ID = "mb-nav-variants-pages-welcome";

test("the variant disclosure button opens and closes its own list", () => {
  const nav = navFixture();
  const doc = asDocument(nav.root);
  let remembered = 0;
  const actions = {
    rememberDisclosures: (): void => {
      remembered += 1;
    },
    updateDiffs: (): void => {},
  };

  assert.equal(handleBrowseControl(doc, asElement(nav.toggle), actions), true);
  assert.equal(nav.list.hidden, false);
  assert.equal(nav.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(
    nav.toggle.getAttribute("aria-label"),
    "Hide variants of Welcome",
  );
  assert.equal(remembered, 1);

  handleBrowseControl(doc, asElement(nav.toggleIcon), actions);
  assert.equal(nav.list.hidden, true);
  assert.equal(nav.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(
    nav.toggle.getAttribute("aria-label"),
    "Show variants of Welcome",
  );
  assert.equal(remembered, 2);
});

test("a filtered variant list keeps its own baseline out of the preference", () => {
  const nav = navFixture();
  nav.list.dataset["filterOpen"] = "0";
  let remembered = 0;

  handleBrowseControl(asDocument(nav.root), asElement(nav.toggle), {
    rememberDisclosures: (): void => {
      remembered += 1;
    },
    updateDiffs: (): void => {},
  });

  assert.equal(nav.list.hidden, false);
  assert.equal(remembered, 0);
});

test("Collapse all closes collection groups and variant lists alike", () => {
  const nav = navFixture();
  nav.list.hidden = false;
  nav.toggle.setAttribute("aria-expanded", "true");

  assert.equal(
    handleBrowseControl(asDocument(nav.root), asElement(nav.collapse), {
      rememberDisclosures: (): void => {},
      updateDiffs: (): void => {},
    }),
    true,
  );

  assert.equal(nav.screens.open, false);
  assert.equal(nav.list.hidden, true);
  assert.equal(nav.toggle.getAttribute("aria-expanded"), "false");
});

test("one disclosure reader spans native groups and variant lists", () => {
  const nav = navFixture();

  assert.equal(isDisclosureOpen(asElement(nav.screens)), true);
  assert.equal(isDisclosureOpen(asElement(nav.list)), false);

  setDisclosureOpen(asElement(nav.list), true);
  setDisclosureOpen(asElement(nav.screens), false);

  assert.equal(isDisclosureOpen(asElement(nav.list)), true);
  assert.equal(nav.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(isDisclosureOpen(asElement(nav.screens)), false);
});

interface ControlsFixture {
  collapse: FakeNode;
  list: FakeNode;
  root: FakeNode;
  screens: FakeNode;
  toggle: FakeNode;
  toggleIcon: FakeNode;
}

function navFixture(): ControlsFixture {
  const toggleIcon = new FakeNode("svg");
  const toggle = new FakeNode("button", {
    "aria-controls": LIST_ID,
    "aria-expanded": "false",
    "aria-label": "Show variants of Welcome",
    "data-nav-variants-label": "Welcome",
    "data-nav-variants-toggle": LIST_ID,
  }).append(toggleIcon);
  const row = new FakeNode(
    "a",
    { "data-nav-row": "", "data-route": "screens/welcome.html" },
    "Welcome",
  );
  const list = new FakeNode("div", {
    "data-nav-disclosure": "variants:pages:welcome",
    "data-nav-variants": "",
    id: LIST_ID,
  }).append(
    new FakeNode(
      "a",
      {
        "data-nav-row": "",
        "data-route": "screens/welcome.variants/empty.html",
      },
      "Empty workspace",
    ),
  );
  list.hidden = true;
  const screens = new FakeNode("details", {
    "data-nav-disclosure": "collection:pages:screens",
  }).append(new FakeNode("div").append(row, toggle), list);
  const collapse = new FakeNode("button", { "data-mokly-collapse": "" });
  return {
    collapse,
    list,
    root: new FakeNode("div").append(collapse, screens),
    screens,
    toggle,
    toggleIcon,
  };
}
