import assert from "node:assert/strict";
import test from "node:test";

import {
  isNavDisclosureKey,
  NavDisclosurePreference,
  type NavPreferenceStorage,
} from "../packages/viewer/dist/client/browse_navigation.js";
import {
  applyNavVisibility,
  selectAndRevealRoute,
} from "../packages/viewer/dist/client/browse_navigation_state.js";

import { asAnchor, asDocument, FakeNode } from "./helpers/fake_dom.js";

const BASE = "http://127.0.0.1:4173/view/screens/welcome.html";

test("stable collection keys preserve independent disclosure across reloads", () => {
  const storage = new FakeStorage();
  const firstAlpha = group("collection:alpha", false);
  const firstBeta = group("collection:beta", true);
  new NavDisclosurePreference(storage).remember(
    fakeDocument(firstAlpha, firstBeta),
  );

  const nextAlpha = group("collection:alpha", true);
  const nextBeta = group("collection:beta", false);
  new NavDisclosurePreference(storage).apply(fakeDocument(nextAlpha, nextBeta));

  assert.equal(nextAlpha.open, false);
  assert.equal(nextBeta.open, true);
});

test("legacy label paths cannot match current disclosure keys", () => {
  assert.equal(isNavDisclosureKey("collection:example-screens"), true);
  assert.equal(isNavDisclosureKey("legacy:archive/screens"), false);
  assert.equal(isNavDisclosureKey("/Example/Screens"), false);

  const current = group("collection:example-screens", true);
  const preference = new NavDisclosurePreference(
    new FakeStorage(JSON.stringify(["/Example/Screens"])),
  );
  preference.apply(fakeDocument(current));
  assert.equal(current.open, true);
});

test("obsolete legacy keys do not discard valid collection preferences", () => {
  const current = group("collection:example-screens", true);
  const other = group("collection:other", false);
  const preference = new NavDisclosurePreference(
    new FakeStorage(
      JSON.stringify(["legacy:example", "collection:example-screens"]),
    ),
  );
  preference.apply(fakeDocument(current, other));
  assert.equal(current.open, false);
  assert.equal(other.open, true);
});

test("removed pages appear only in Changes while removed screens remain in All", () => {
  const nav = navFixture();
  nav.glossary.setAttribute("data-removed-page", "");
  nav.glossary.setAttribute("data-changed", "true");
  nav.details.setAttribute("data-changed", "true");
  applyNavVisibility(asDocument(nav.root), "preserve");
  assert.equal(nav.glossary.hidden, true);
  assert.equal(nav.details.hidden, false);
  nav.changed.setAttribute("aria-pressed", "true");
  applyNavVisibility(asDocument(nav.root), "preserve");
  assert.equal(nav.glossary.hidden, false);
  assert.equal(nav.details.hidden, false);
});

test("a tag term hides untagged rows and the groups they empty", () => {
  const nav = navFixture();
  nav.screens.open = false;
  nav.search.value = "tag:onboarding";

  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.welcome.hidden, false);
  assert.equal(nav.details.hidden, true);
  assert.equal(nav.glossary.hidden, true);
  assert.equal(nav.screens.hidden, false);
  assert.equal(nav.screens.open, true);
  assert.equal(nav.docs.hidden, true);

  nav.search.value = "";
  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.details.hidden, false);
  assert.equal(nav.glossary.hidden, false);
  assert.equal(nav.docs.hidden, false);
  assert.equal(nav.screens.open, false);
});

test("a tag term composes with the Changed filter", () => {
  const nav = navFixture();
  nav.welcome.setAttribute("data-changed", "true");
  nav.glossary.setAttribute("data-changed", "true");
  nav.changed.setAttribute("aria-pressed", "true");
  nav.search.value = "tag:onboarding";

  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.welcome.hidden, false);
  assert.equal(nav.glossary.hidden, true);
  assert.equal(nav.details.hidden, true);
  assert.equal(nav.screens.hidden, false);
  assert.equal(nav.docs.hidden, true);

  nav.welcome.setAttribute("data-changed", "false");
  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.welcome.hidden, true);
  assert.equal(nav.screens.hidden, true);
});

test("row tags split on any whitespace the markup carries", () => {
  const nav = navFixture();
  nav.welcome.setAttribute("data-tags", "forms\tonboarding");
  nav.search.value = "tag:onboarding";

  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.welcome.hidden, false);
  assert.equal(nav.details.hidden, true);
});

test("free text still matches rows that declare no tags", () => {
  const nav = navFixture();
  nav.search.value = "GLOSSARY";

  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.glossary.hidden, false);
  assert.equal(nav.welcome.hidden, true);
  assert.equal(nav.screens.hidden, true);
});

test("free text filters structured rows by their page id", () => {
  const nav = navFixture();
  nav.search.value = "transactions-list-transfer-ready";

  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.details.hidden, false);
  assert.equal(nav.welcome.hidden, true);
  assert.equal(nav.glossary.hidden, true);
  assert.equal(nav.screens.hidden, false);
  assert.equal(nav.docs.hidden, true);
});

test("navigation clears only a query that hides its destination", () => {
  const nav = navFixture();
  nav.pages.open = false;
  nav.screens.open = false;
  nav.search.value = "tag:onboarding";

  const welcome = selectAndRevealRoute(
    asDocument(nav.root),
    "/view/screens/welcome.html",
    BASE,
    "navigation",
  );

  assert.equal(welcome, asAnchor(nav.welcome));
  assert.equal(nav.search.value, "tag:onboarding");
  assert.equal(nav.welcome.getAttribute("aria-current"), "page");
  assert.equal(nav.welcome.scrolled, true);
  assert.equal(nav.welcome.hidden, false);
  assert.equal(nav.details.hidden, true);
  assert.equal(nav.pages.open, true);
  assert.equal(nav.screens.open, true);

  const details = selectAndRevealRoute(
    asDocument(nav.root),
    "/view/screens/details.html",
    BASE,
    "navigation",
  );

  assert.equal(details, asAnchor(nav.details));
  assert.equal(nav.search.value, "");
  assert.equal(nav.details.hidden, false);
  assert.equal(nav.glossary.hidden, false);
});

/** One catalogue column with its All/Changed filter: two tagged screens and
 * one untagged legacy page. */
interface NavFixture {
  changed: FakeNode;
  details: FakeNode;
  docs: FakeNode;
  glossary: FakeNode;
  pages: FakeNode;
  root: FakeNode;
  screens: FakeNode;
  search: FakeNode;
  welcome: FakeNode;
}

function navFixture(): NavFixture {
  const search = new FakeNode("input", { "data-mokly-search": "" });
  const welcome = navRow(
    "screens/welcome.html",
    "Welcome",
    "forms onboarding",
    "welcome",
  );
  const details = navRow(
    "screens/details.html",
    "Details",
    "forms",
    "transactions-list-transfer-ready",
  );
  const glossary = navRow("docs/glossary.html", "Glossary");
  const screens = navGroup("collection:screens", welcome, details);
  const docs = navGroup("collection:docs", glossary);
  const changed = filterOption("changed", "false");
  const pages = navGroup("section:pages", screens, docs);
  const root = new FakeNode("div").append(
    search,
    filterOption("all", "true"),
    changed,
    pages,
  );
  return {
    changed,
    details,
    docs,
    glossary,
    pages,
    root,
    screens,
    search,
    welcome,
  };
}

function navRow(
  route: string,
  label: string,
  tags?: string,
  id?: string,
): FakeNode {
  return new FakeNode(
    "a",
    {
      "data-nav-row": "",
      "data-route": route,
      href: `/view/${route}`,
      ...(id === undefined ? {} : { "data-entry-id": id }),
      ...(tags === undefined ? {} : { "data-tags": tags }),
    },
    label,
  );
}

function navGroup(key: string, ...rows: readonly FakeNode[]): FakeNode {
  return new FakeNode("details", {
    "data-nav-disclosure": key,
    ...(key.startsWith("collection:") ? { "data-nav-collection": key } : {}),
  }).append(...rows);
}

function filterOption(name: string, pressed: string): FakeNode {
  return new FakeNode("button", {
    "aria-pressed": pressed,
    "data-filter": name,
  });
}

function group(key: string, open: boolean): HTMLDetailsElement {
  return {
    getAttribute(name: string) {
      return name === "data-nav-disclosure" ? key : null;
    },
    open,
  } as HTMLDetailsElement;
}

function fakeDocument(...groups: HTMLDetailsElement[]): Document {
  return {
    querySelectorAll(selector: string) {
      assert.equal(selector, "details[data-nav-disclosure]");
      return groups;
    },
  } as unknown as Document;
}

class FakeStorage implements NavPreferenceStorage {
  constructor(public value: string | null = null) {}

  getItem(): string | null {
    return this.value;
  }

  setItem(_key: string, value: string): void {
    this.value = value;
  }
}
