import assert from "node:assert/strict";
import test from "node:test";

import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { buildNavSections } from "../packages/viewer/dist/shell/nav_tree.js";

import { attribute, textContent } from "./helpers/html.js";
import {
  assertAttributes,
  context,
  hasClass,
  homePage,
  manifest,
  requiredElement,
  viewPage,
} from "./shell_fixture.js";

test("nav tree nests pages and screens in one declared hierarchy", () => {
  const catalogue = createCatalogue(manifest);
  const tree = buildNavSections(catalogue.hierarchy)[0]!.children;
  const labels = tree.map((node) => node.label);
  assert.deepEqual(labels, ["Example"]);
  const example = tree[0];
  assert.ok(example?.kind === "group");
  const screens = example.children.find((node) => node.label === "Screens");
  assert.ok(screens?.kind === "group");
  assert.deepEqual(
    screens.children.map((node) => node.label),
    ["Details", "Welcome"],
  );
  const tour = example.children.find((node) => node.label === "Tour");
  assert.ok(tour?.kind === "leaf" && tour.entryKind === "use-case");
  assert.deepEqual(
    example.children
      .filter((node) => node.kind === "leaf" && node.entryKind === "page")
      .map((node) => node.label),
    ["Old", "Overview"],
  );
});

test("page breadcrumbs use path folders without invented Overview links", () => {
  const catalogue = createCatalogue(manifest);
  const entry = catalogue.byId.get("old");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, {
    ...context,
    activeId: "old",
  });
  assert.match(
    html,
    /aria-label="Catalogue location" class="mbk-crumbs"><span>Example<\/span>/,
  );
  assert.match(html, /class="mbk-stage-embed"/);
});

test("catalogue nav marks active, changed, and iconed rows", () => {
  const catalogue = createCatalogue(manifest);
  const entry = catalogue.byId.get("welcome");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, {
    ...context,
    activeId: "welcome",
    changedIds: ["welcome"],
  });
  assert.match(
    html,
    /aria-current="page"[^>]*data-route="screens\/welcome\.html"/,
  );
  assert.match(html, /data-changed="true"/);
  assert.match(
    html,
    /data-entry-id="welcome"[^>]*data-route="screens\/welcome\.html"[^>]*data-tags="forms onboarding"/,
  );
  assert.match(
    html,
    /data-entry-id="details"[^>]*data-route="screens\/details\.html"[^>]*data-tags="billing"/,
  );
  assert.equal(
    /data-route="user-flows\/tour\.html"[^>]*data-tags/.test(html),
    false,
  );
  assert.match(
    html,
    /data-nav-disclosure="section:pages" data-nav-section="pages"/,
  );
  assert.doesNotMatch(html, /data-nav-section="components"/);
  assert.match(html, /data-nav-folder="folder:Example\/Screens"/);
  assert.match(html, /data-nav-disclosure="folder:pages:Example\/Screens"/);
  assert.match(html, /data-entry-kind="screen"/);
  assert.match(html, /class="mbk-nav-ico folder"><svg/);
  assert.match(html, /class="mbk-nav-count">2</);
  assert.match(html, /Collapse all/);
  assert.match(html, /data-mokly-nav-resize=""/);
  assert.match(
    html,
    /aria-label="Resize navigation panel"[^>]*aria-orientation="vertical"[^>]*role="separator"/,
  );
  const inactive = homePage(catalogue, context);
  assert.equal(inactive.includes('aria-current="page"[^>]*data-route'), false);
});

test("screen page renders device chrome, viewport switch, and details", () => {
  const catalogue = createCatalogue(manifest);
  const entry = catalogue.byId.get("welcome");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, {
    ...context,
    activeId: "welcome",
  });
  assert.match(
    html,
    /class="mbk-frag"[^>]*sandbox="allow-same-origin"[^>]*welcome\.mobile/,
  );
  assert.match(
    html,
    /class="mbk-frag"[^>]*sandbox="allow-same-origin"[^>]*welcome\.desktop/,
  );
  assert.match(html, /class="phone-frame"/);
  assert.equal(html.match(/class="phone-frame"/g)?.length, 1);
  assert.match(html, /class="phone-notch"/);
  assert.match(
    html,
    /class="phone-status"><span>9:41<\/span><span class="phone-status-icons">(<svg[\s\S]*?<\/svg>){3}<\/span><\/div><iframe/,
  );
  assert.match(html, /class="browser-frame"/);
  assert.equal(html.match(/class="browser-frame"/g)?.length, 1);
  assert.match(html, /class="browser-expand"/);
  assert.match(html, /class="address-url">example\.test\/welcome</);
  assert.match(html, /data-mokly-stage="" data-viewport="both"/);
  assert.match(html, /<option value="mobile">Mobile<\/option>/);
  assert.match(html, /aria-label="Viewport" data-workspace-viewport=""/);
  assert.equal(html.includes('class="mbk-viewbar"'), false);
  assert.match(html, /class="mbk-crumbs"/);
  const idButton = requiredElement(
    html,
    (element) => attribute(element, "data-copy-id") === "welcome",
  );
  assertAttributes(idButton, {
    "aria-label": "Copy ID welcome",
    class: "mbk-idchip",
    href: undefined,
    type: "button",
  });
  assert.equal(textContent(idButton), "#welcome");
  assert.match(html, /Proves the shell/);
  assert.match(html, /notes\.md/);
  const inspector = requiredElement(
    html,
    (element) => attribute(element, "data-workspace-inspector") !== undefined,
  );
  assert.equal(inspector.tagName, "section");
  assert.equal(hasClass(inspector, "mbk-inspector"), true);
  requiredElement(
    html,
    (element) =>
      attribute(element, "role") === "tab" &&
      attribute(element, "aria-label") === "Details",
  );
  requiredElement(
    html,
    (element) =>
      hasClass(element, "mbk-chip") &&
      hasClass(element, "flow") &&
      attribute(element, "href") === "/view/user-flows/tour.html",
  );
  assert.match(html, /aria-live="polite"/);
});

test("use-case page renders the flow with catalogue links per step", () => {
  const catalogue = createCatalogue(manifest);
  const entry = catalogue.byId.get("tour");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, context);
  const welcomeLink = requiredElement(
    html,
    (element) =>
      hasClass(element, "flow-step-link") &&
      attribute(element, "href") === "/view/screens/welcome.html",
  );
  assert.equal(
    textContent(welcomeLink),
    "This screen in the catalogue: Welcome →",
  );
  assert.match(html, /class="flow-step-num"/);
  assert.match(html, /class="mbk-flow-screen"/);
});
