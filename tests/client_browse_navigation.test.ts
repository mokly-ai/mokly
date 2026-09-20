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

test("variant list keys join the persisted disclosure identities", () => {
  assert.equal(isNavDisclosureKey("variants:pages:welcome"), true);
  assert.equal(isNavDisclosureKey("variants:components:welcome"), true);
  assert.equal(isNavDisclosureKey("variants:welcome"), false);
  assert.equal(isNavDisclosureKey("variants:"), false);
});

test("a closed variant list round-trips through the stored preference", () => {
  const storage = new FakeStorage();
  const nav = navFixture();
  nav.welcomeList.hidden = false;
  nav.welcomeToggle.setAttribute("aria-expanded", "true");
  new NavDisclosurePreference(storage).remember(asDocument(nav.root));
  assert.equal(
    (JSON.parse(storage.value ?? "[]") as string[]).includes(
      "variants:pages:welcome",
    ),
    false,
  );

  nav.welcomeList.hidden = true;
  nav.welcomeToggle.setAttribute("aria-expanded", "false");
  new NavDisclosurePreference(storage).remember(asDocument(nav.root));
  assert.deepEqual(JSON.parse(storage.value ?? "[]"), [
    "variants:pages:welcome",
  ]);

  const restored = navFixture();
  restored.welcomeList.hidden = false;
  restored.welcomeToggle.setAttribute("aria-expanded", "true");
  new NavDisclosurePreference(storage).apply(asDocument(restored.root));
  assert.equal(restored.welcomeList.hidden, true);
  assert.equal(restored.welcomeToggle.getAttribute("aria-expanded"), "false");
  assert.equal(
    restored.welcomeToggle.getAttribute("aria-label"),
    "Show variants of Welcome",
  );
  assert.equal(restored.screens.open, true);
});

test("navigating to a variant opens the list holding its row", () => {
  const nav = navFixture();
  nav.pages.open = false;
  nav.screens.open = false;

  const active = selectAndRevealRoute(
    asDocument(nav.root),
    "/view/screens/welcome.variants/empty.html",
    BASE,
    "navigation",
  );

  assert.equal(active, asAnchor(nav.welcomeEmpty));
  assert.equal(nav.welcomeEmpty.getAttribute("aria-current"), "page");
  assert.equal(nav.welcomeList.hidden, false);
  assert.equal(nav.welcomeToggle.getAttribute("aria-expanded"), "true");
  assert.equal(
    nav.welcomeToggle.getAttribute("aria-label"),
    "Hide variants of Welcome",
  );
  assert.equal(nav.screens.open, true);
  assert.equal(nav.pages.open, true);
});

test("a search that matches only a variant keeps its parent row visible", () => {
  const nav = navFixture();
  nav.search.value = "Empty workspace";

  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.welcomeEmpty.hidden, false);
  assert.equal(nav.welcome.hidden, false);
  assert.equal(nav.welcomeList.hidden, false);
  assert.equal(nav.details.hidden, true);
  assert.equal(nav.glossary.hidden, true);
  assert.equal(nav.screens.hidden, false);

  nav.search.value = "glossary";
  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.welcome.hidden, true);
  assert.equal(nav.welcomeEmpty.hidden, true);
  assert.equal(nav.welcomeList.hidden, true);
});

test("a changed variant marks its parent row and survives the Changes filter", () => {
  const nav = navFixture();
  nav.welcomeEmpty.setAttribute("data-changed", "true");
  nav.changed.setAttribute("aria-pressed", "true");

  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.welcomeEmpty.hidden, false);
  assert.equal(nav.welcome.hidden, false);
  assert.equal(nav.welcome.getAttribute("data-changed-variants"), "true");
  assert.equal(nav.welcomeList.hidden, false);
  assert.equal(nav.details.hidden, true);

  nav.welcomeEmpty.removeAttribute("data-changed");
  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.welcome.getAttribute("data-changed-variants"), null);
  assert.equal(nav.welcome.hidden, true);
});

test("a removed variant shows under its parent only while Changes is on", () => {
  const nav = navFixture();
  const gone = removedVariantRow();
  nav.welcomeList.append(gone);

  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(gone.hidden, true);
  assert.equal(nav.welcome.hidden, false);
  assert.equal(nav.welcome.getAttribute("data-changed-variants"), "true");

  nav.changed.setAttribute("aria-pressed", "true");
  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(gone.hidden, false);
  assert.equal(nav.welcomeEmpty.hidden, true);
  assert.equal(nav.welcome.hidden, false);
  assert.equal(nav.welcomeList.hidden, false);
  assert.equal(nav.details.hidden, true);
});

test("the mark's reader text never becomes a search term", () => {
  const nav = navFixture();
  nav.welcome.append(
    new FakeNode("span", { "data-nav-changed-text": "" }, "Changed"),
  );
  nav.search.value = "changed";

  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.welcome.hidden, true);

  nav.search.value = "welcome";
  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.welcome.hidden, false);
});

/** A deleted variant retained under a surviving parent's disclosed list. */
function removedVariantRow(): FakeNode {
  return new FakeNode(
    "a",
    {
      "data-changed": "true",
      "data-entry-id": "welcome-gone",
      "data-nav-removed": "",
      "data-nav-row": "",
      "data-removed-variant": "",
      "data-route": "screens/welcome.variants/gone.html",
      href: "/view/screens/welcome.variants/gone.html",
    },
    "Workspace deleted \u00b7 Removed",
  );
}

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
  welcomeEmpty: FakeNode;
  welcomeList: FakeNode;
  welcomeToggle: FakeNode;
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
  const welcomeEmpty = navRow(
    "screens/welcome.variants/empty.html",
    "Empty workspace",
    "forms onboarding",
    "welcome-empty",
  );
  const welcomeToggle = variantToggle("mb-nav-variants-pages-welcome");
  const welcomeList = variantList(
    "variants:pages:welcome",
    "mb-nav-variants-pages-welcome",
    welcomeEmpty,
  );
  const welcomeLeaf = new FakeNode("div").append(welcome, welcomeToggle);
  const screens = navGroup(
    "collection:screens",
    welcomeLeaf,
    welcomeList,
    details,
  );
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
    welcomeEmpty,
    welcomeList,
    welcomeToggle,
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

function variantToggle(listId: string): FakeNode {
  return new FakeNode("button", {
    "aria-controls": listId,
    "aria-expanded": "false",
    "aria-label": "Show variants of Welcome",
    "data-nav-variants-label": "Welcome",
    "data-nav-variants-toggle": listId,
  });
}

function variantList(
  key: string,
  listId: string,
  ...rows: readonly FakeNode[]
): FakeNode {
  const list = new FakeNode("div", {
    "data-nav-disclosure": key,
    "data-nav-variants": "",
    id: listId,
  }).append(...rows);
  list.hidden = true;
  return list;
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
      assert.equal(selector, "[data-nav-disclosure]");
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
