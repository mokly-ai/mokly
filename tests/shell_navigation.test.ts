import assert from "node:assert/strict";
import test from "node:test";

import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { buildNavSections } from "../packages/viewer/dist/shell/nav_tree.js";

import {
  context,
  homePage,
  manifest,
  notFoundPage,
  viewPage,
} from "./helpers/shell_fixture.js";

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
  const entry = catalogue.byPath.get("example/old");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, {
    ...context,
    activeId: "example/old",
  });
  assert.match(
    html,
    /aria-label="Catalogue location" class="mbk-crumbs"><span><button[^>]*data-crumb-folder="example"[^>]*>Example<\/button>/,
  );
  assert.match(html, /class="mbk-stage-embed"/);
});

test("catalogue nav marks active, changed, and iconed rows", () => {
  const catalogue = createCatalogue(manifest);
  const entry = catalogue.byPath.get("example/screens/welcome");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, {
    ...context,
    activeId: "example/screens/welcome",
    changedEntries: ["example/screens/welcome"],
  });
  assert.match(
    html,
    /aria-current="page"[^>]*data-route="example\/screens\/welcome\/index\.html"/,
  );
  assert.match(html, /data-changed="true"/);
  assert.match(
    html,
    /data-entry-id="example\/screens\/welcome"[^>]*data-route="example\/screens\/welcome\/index\.html"[^>]*data-tags="forms onboarding"/,
  );
  assert.match(
    html,
    /data-entry-id="example\/screens\/details"[^>]*data-route="example\/screens\/details\/index\.html"[^>]*data-tags="billing"/,
  );
  assert.equal(
    /data-route="example\/tour\/index\.html"[^>]*data-tags/.test(html),
    false,
  );
  assert.match(
    html,
    /data-nav-disclosure="section:specs" data-nav-section="specs"/,
  );
  assert.doesNotMatch(html, /data-nav-section="components"/);
  assert.match(html, /data-nav-folder="folder:example\/screens"/);
  assert.match(html, /data-nav-disclosure="folder:specs:example\/screens"/);
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

test("missing routes keep the catalogue shell", () => {
  const catalogue = createCatalogue(manifest);
  const missing = notFoundPage("view/unknown.html", catalogue, context);
  assert.match(missing, /Item not found/);
  assert.match(missing, /choose another item from the navigation/);
  assert.match(missing, /If this item was just added/);
  assert.match(missing, /aria-label="Catalogue"/);
});

test("filter renders in the nav only when changed routes are known", () => {
  const catalogue = createCatalogue(manifest);
  const withFilter = homePage(catalogue, {
    ...context,
    changedEntries: ["example/screens/welcome"],
  });
  assert.match(withFilter, /data-mokly-filter/);
  assert.match(withFilter, /class="mbk-nav-filter-count">1</);
  const withNoChanges = homePage(catalogue, {
    ...context,
    changedEntries: [],
  });
  assert.match(withNoChanges, /data-mokly-filter/);
  assert.match(withNoChanges, /class="mbk-nav-filter-count">0</);
  const withoutFilter = homePage(catalogue, context);
  assert.equal(withoutFilter.includes("data-mokly-filter"), false);
  assert.match(withoutFilter, /data-mokly-search/);
});
