import assert from "node:assert/strict";
import { test } from "node:test";

import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import type { CatalogueReadModel } from "../src/catalogue/types.js";

import {
  detailPairs,
  rawDetailFixtures,
  rawIndexFixture,
} from "./catalogue_v8_fixture.js";
import {
  embeddedMarkup,
  heldEmbeddedMarkup,
  withDarkViews,
} from "./presentation_v7_helpers.js";

const SECOND = "components/action/second";

/** The fixture with a second saved variant of Action beside Default. */
function withSecondVariant(): CatalogueReadModel {
  const index = rawIndexFixture();
  const original = index.components.find(
    (entry) => entry.path === "components/action/default",
  )!;
  index.components = [
    ...index.components,
    {
      ...structuredClone(original),
      path: SECOND,
      title: "Second",
      views: original.views.map((view) => structuredClone(view)),
    },
  ];
  const componentFolder = index.tree.find(
    (node) => node.kind === "folder" && node.path === "components",
  );
  const actionNode = componentFolder?.children?.find(
    (node) => node.kind === "entry" && node.path === "components/action",
  );
  if (actionNode?.kind === "entry")
    actionNode.children = [
      ...(actionNode.children ?? []),
      { kind: "entry", path: SECOND },
    ];
  return index;
}

test("the embedded viewer selects a component variant entry in navigation, chrome, and preview", () => {
  const index = withSecondVariant();
  const html = embeddedMarkup({
    index,
    defaultSelection: { screenPath: SECOND },
  });
  assert.match(html, /<h2>Action<\/h2>/);
  assert.match(
    html,
    /data-copy-path="components\/action\/second"[^>]*>components\/action\/second<\/button>/,
  );
  assert.match(
    html,
    /aria-label="Catalogue location"[^]*href="\/view\/components\/action\/"[^]*Action/,
  );
  assert.match(
    html,
    /aria-label="Saved variants"[^]*aria-current="page"[^]*href="\/view\/components\/action\/second\/"[^]*Second/,
  );
  assert.match(
    html,
    /data-nav-disclosure="variants:components\/action"[^]*data-route="components\/action\/second\/index\.html"/,
  );
  // The preview renders once the variant's detail is held.
  const fixtures = rawDetailFixtures();
  fixtures.current[SECOND] = {
    ...structuredClone(fixtures.current["components/action/default"]!),
    entry: { kind: "component", path: SECOND },
  };
  assert.match(
    heldEmbeddedMarkup({
      index,
      details: detailPairs(undefined, fixtures),
      selection: { screenPath: SECOND },
    }),
    /components\/action\/second\/index\.(?:mobile|desktop)\.html/,
  );
});

test("the embedded viewer resolves light fallback evidence across status, marks and comparison", () => {
  const index = rawIndexFixture();
  const screen = index.screens.find(
    (entry) => entry.path === "product/browse/home",
  );
  if (!screen) throw new Error("Missing mixed-view fixture");
  screen.changes = { status: "ready", kind: "changed", included: true };
  screen.views = screen.views.map((view) => ({
    ...view,
    comparison: {
      status: "ready",
      kind: view.viewport === "mobile" ? "unmodified" : "changed",
      eligible: view.viewport !== "mobile",
    },
  }));
  // Action and its variants offer Dark, so the catalogue has dark previews.
  for (const component of index.components) {
    component.colorSchemes = ["light", "dark"];
    component.views = withDarkViews(component.views);
  }

  const html = embeddedMarkup({
    index,
    defaultSelection: {
      screenPath: screen.path,
      viewport: "mobile",
      colorScheme: "dark",
    },
  });

  assert.match(html, /data-workspace-status="">Unmodified</);
  assert.match(html, /class="mbk-diff-toolbar" hidden=""/);
  assert.match(html, /data-view-changed="scheme" hidden=""/);
  assert.doesNotMatch(html, /data-view-changed="viewport" hidden=""/);
});

test("the embedded viewer preserves comparison ineligibility while view evidence is unknown", () => {
  const index = rawIndexFixture();
  const component = index.components.find(
    (entry) => entry.path === "components/action",
  );
  if (!component || component.variantOf !== undefined)
    throw new Error("Missing component fixture");
  component.changes = { status: "ready", kind: "changed", included: true };

  const html = embeddedMarkup({
    index,
    defaultSelection: { screenPath: component.path },
  });

  assert.match(html, /data-workspace-status="">Changed</);
  assert.match(html, /class="mbk-diff-toolbar" hidden=""/);
});

test("incomplete current view axes are rejected", () => {
  const index = rawIndexFixture();
  const screen = index.screens[0]!;
  screen.views = [];
  assert.throws(() => readCatalogueIndex(index), /views must match axes/);
  const html = embeddedMarkup({
    index,
    defaultSelection: { screenPath: screen.path },
  });
  assert.match(html, /role="alert"/);
  assert.match(html, /The catalogue could not be loaded/);
  assert.doesNotMatch(html, /data-mokly-shell/);
});
