import assert from "node:assert/strict";
import test from "node:test";

import {
  isNavDisclosureKey,
  NavDisclosurePreference,
} from "../packages/viewer/dist/client/browse_navigation.js";
import { selectAndRevealRoute } from "../packages/viewer/dist/client/browse_navigation_state.js";

import {
  BROWSE_BASE,
  disclosureDocument,
  disclosureGroup,
  FakeStorage,
  navFixture,
} from "./helpers/browse_navigation_fixture.js";
import { asAnchor, asDocument } from "./helpers/fake_dom.js";

test("stable collection keys preserve independent disclosure across reloads", () => {
  const storage = new FakeStorage();
  const firstAlpha = disclosureGroup("collection:alpha", false);
  const firstBeta = disclosureGroup("collection:beta", true);
  new NavDisclosurePreference(storage).remember(
    disclosureDocument(firstAlpha, firstBeta),
  );

  const nextAlpha = disclosureGroup("collection:alpha", true);
  const nextBeta = disclosureGroup("collection:beta", false);
  new NavDisclosurePreference(storage).apply(
    disclosureDocument(nextAlpha, nextBeta),
  );

  assert.equal(nextAlpha.open, false);
  assert.equal(nextBeta.open, true);
});

test("legacy label paths cannot match current disclosure keys", () => {
  assert.equal(isNavDisclosureKey("collection:example-screens"), true);
  assert.equal(isNavDisclosureKey("legacy:archive/screens"), false);
  assert.equal(isNavDisclosureKey("/Example/Screens"), false);

  const current = disclosureGroup("collection:example-screens", true);
  const preference = new NavDisclosurePreference(
    new FakeStorage(JSON.stringify(["/Example/Screens"])),
  );
  preference.apply(disclosureDocument(current));
  assert.equal(current.open, true);
});

test("obsolete legacy keys do not discard valid collection preferences", () => {
  const current = disclosureGroup("collection:example-screens", true);
  const other = disclosureGroup("collection:other", false);
  const preference = new NavDisclosurePreference(
    new FakeStorage(
      JSON.stringify(["legacy:example", "collection:example-screens"]),
    ),
  );
  preference.apply(disclosureDocument(current, other));
  assert.equal(current.open, false);
  assert.equal(other.open, true);
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
    BROWSE_BASE,
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
