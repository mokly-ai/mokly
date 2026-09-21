import assert from "node:assert/strict";
import test from "node:test";

import {
  applyNavVisibility,
  selectAndRevealRoute,
} from "../packages/viewer/dist/client/browse_navigation_state.js";

import {
  BROWSE_BASE,
  navFixture,
  removedVariantRow,
} from "./helpers/browse_navigation_fixture.js";
import { asAnchor, asDocument, FakeNode } from "./helpers/fake_dom.js";

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
    BROWSE_BASE,
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
    BROWSE_BASE,
    "navigation",
  );

  assert.equal(details, asAnchor(nav.details));
  assert.equal(nav.search.value, "");
  assert.equal(nav.details.hidden, false);
  assert.equal(nav.glossary.hidden, false);
});

test("a search that matches only a variant keeps its parent row visible", () => {
  const nav = navFixture();
  nav.search.value = "Empty workspace";

  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.welcomeEmpty.hidden, false);
  assert.equal(nav.welcome.hidden, false);
  assert.equal(nav.welcomeLeaf.hidden, false);
  assert.equal(nav.welcomeList.hidden, false);
  assert.equal(nav.details.hidden, true);
  assert.equal(nav.glossary.hidden, true);
  assert.equal(nav.screens.hidden, false);

  nav.search.value = "glossary";
  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.welcome.hidden, true);
  assert.equal(nav.welcomeLeaf.hidden, true);
  assert.equal(nav.welcomeEmpty.hidden, true);
  assert.equal(nav.welcomeList.hidden, true);

  nav.search.value = "";
  applyNavVisibility(asDocument(nav.root), "reveal-matches");

  assert.equal(nav.welcome.hidden, false);
  assert.equal(nav.welcomeLeaf.hidden, false);
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
