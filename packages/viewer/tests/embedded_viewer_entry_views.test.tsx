import assert from "node:assert/strict";
import { test } from "node:test";

import type { DetailRequest } from "../src/catalogue/detail_fences.js";
import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import { shellCatalogueModel } from "../src/catalogue/shell_model.js";
import type {
  CatalogueReadModel,
  EntryDetailV4,
} from "../src/catalogue/types.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { routeDetailRequests } from "../src/shell/data_requests.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { embeddedDataSource } from "../src/viewer/index_source.js";

import {
  detailPairs,
  detailFixture,
  rawDetailFixtures,
  rawIndexFixture,
} from "./catalogue_v9_fixture.js";
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
  assert.match(html, /<h2 class="mbk-reset">Action<\/h2>/);
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

test("the embedded viewer requests a variant parent and shows its usage", async () => {
  const rawIndex = rawIndexFixture();
  const index = readCatalogueIndex(rawIndex);
  const calls: string[] = [];
  const source = embeddedDataSource(
    rawIndex,
    { index, root: new URL("https://catalogue.example/") },
    (path, snapshotId) => {
      calls.push(path);
      return detailFixture({ path, ...(snapshotId ? { snapshotId } : {}) });
    },
    { deploymentChanged() {}, detailFailed() {} },
  );
  const route = routeFromUrl(
    // The route resolver needs the same validated index that the source holds.
    // Its details are not needed to resolve a current selection.
    createCatalogue(shellCatalogueModel(index, new Map())),
    new URL("/view/components/action/default/", "https://catalogue.example"),
  );
  const requests = routeDetailRequests(index, route);
  const details: (readonly [DetailRequest, EntryDetailV4])[] = [];
  for (const request of requests)
    details.push([
      request,
      await source.loadDetail(request, index, new AbortController().signal),
    ]);
  assert.deepEqual(calls, ["components/action/default", "components/action"]);
  const parentDetail = details.find(
    ([request]) => request.path === "components/action",
  )?.[1];
  assert.ok(parentDetail?.workspace);
  parentDetail.workspace = {
    ...parentDetail.workspace,
    usedBy: [
      {
        entryPath: "product/browse/home",
        entryKind: "screen",
        title: "Welcome",
        viewport: "mobile",
        colorScheme: "light",
        instanceKey: "a".repeat(64),
        direct: true,
        removed: false,
        comparisonEligible: false,
      },
    ],
  };
  const html = heldEmbeddedMarkup({
    index: rawIndex,
    details,
    selection: { screenPath: "components/action/default" },
  });
  assert.match(html, /<h3 class="mbk-reset">Used by<\/h3>/);
  assert.match(html, /data-usage-section="used-by"[\s\S]*>Welcome<\/a>/);
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
  assert.match(html, /class="mbk-diff-toolbar mbk-reset" hidden=""/);
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
  assert.match(html, /class="mbk-diff-toolbar mbk-reset" hidden=""/);
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
