import assert from "node:assert/strict";
import test from "node:test";

import { folderTitleLookup } from "../src/registry/folder_titles.js";
import { analyzeHierarchy } from "../src/registry/hierarchy.js";
import type { ManifestEntry, ManifestFolder } from "../src/registry/types.js";
import { changesActivation } from "../src/shell/changes_activation.js";
import type { ShellContext } from "../src/shell/context.js";
import {
  catalogueNavSections,
  navLeafVisible,
  navNodeVisible,
} from "../src/shell/nav_model.js";
import {
  buildNavSections,
  type NavLeafNode,
  type NavNode,
  type NavSectionNode,
} from "../src/shell/nav_tree.js";
import type { ShellRoute } from "../src/shell/routes.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { defaultSelection, revealSelection } from "../src/viewer/selection.js";

import { shellModelFixture } from "./catalogue_v9_fixture.js";
import {
  publishedScreen,
  publishedModel,
  removedScreenVariant,
} from "./published_entries_fixture.js";

const context: ShellContext = {
  base: "main",
  changesStatus: "ready",
};

/** Every row in the sections, keyed by entry path; removed rows win ties. */
function rows(sections: readonly NavSectionNode[]) {
  const found = new Map<string, NavLeafNode>();
  const visit = (nodes: readonly NavNode[]): void => {
    for (const node of nodes) {
      if (node.kind === "group") visit(node.children);
      else {
        found.set(node.entryId, node);
        visit(node.variants ?? []);
        visit(node.members ?? []);
      }
    }
  };
  for (const section of sections) visit(section.children);
  return found;
}

const entry = (
  path: string,
  kind: string,
  title: string,
  extra: Partial<Record<"tags" | "variantOf", unknown>> = {},
): ManifestEntry => ({ path, kind, title, ...extra }) as ManifestEntry;

const entries = [
  entry("billing/invoice", "screen", "Invoice"),
  entry("billing/invoice/overdue", "screen", "Overdue", {
    variantOf: "billing/invoice",
  }),
  entry("billing/terms", "page", "Terms", { tags: ["legal"] }),
  entry("account/profile", "screen", "Your profile"),
  entry("account/profile/unverified", "screen", "Unverified email", {
    variantOf: "account/profile",
  }),
  entry("account/profile/security", "screen", "Security"),
  entry("welcome", "screen", "Welcome home"),
  entry("welcome/empty", "screen", "Empty", { variantOf: "welcome" }),
  entry("guide", "document", "Guide"),
  entry("guide/setup", "page", "Setup"),
];
const record = (path: string, extra: Partial<ManifestFolder>) => ({
  path,
  sourcePath: `specs/${path}/_folder.json`,
  ...extra,
});

test("search matches a folder's resolved title and shows every row below it", () => {
  const visible = (
    folders: readonly ManifestFolder[],
    search: string,
    tags: readonly string[] = [],
  ) => {
    const found = rows(
      buildNavSections(analyzeHierarchy(entries, folders).hierarchy),
    );
    return [...found.values()]
      .filter((row) =>
        navLeafVisible(row, { view: "all", search, tags }, context),
      )
      .map((row) => row.entryId)
      .sort();
  };
  const titled = [
    record("billing", { title: "Billing & Payments" }),
    record("guide", { title: "Handbook" }),
  ];
  assert.deepEqual(visible(titled, "payments"), [
    "billing/invoice",
    "billing/invoice/overdue",
    "billing/terms",
  ]);
  assert.deepEqual(visible(titled, "payments", ["legal"]), ["billing/terms"]);
  assert.deepEqual(visible(titled, "handbook"), ["guide", "guide/setup"]);
  assert.deepEqual(visible(titled, "your profile"), [
    "account/profile",
    "account/profile/security",
    "account/profile/unverified",
  ]);
  assert.deepEqual(visible(titled, "welcome home"), ["welcome"]);
  assert.deepEqual(
    visible([...titled, record("account", { hidden: true })], "your profile"),
    [],
  );
  const billing = buildNavSections(
    analyzeHierarchy(entries, titled).hierarchy,
  )[0]?.children.find((node) => node.key === "folder:billing");
  assert.ok(billing);
  assert.equal(
    navNodeVisible(
      billing,
      { view: "all", search: "payments", tags: [] },
      context,
    ),
    true,
  );
});

test("Changes activation searches a removed variant as its row does", () => {
  const parent = { path: "start/welcome", title: "Welcome" };
  const removed = "start/welcome/old";
  const model = publishedModel({
    screens: [
      publishedScreen(parent.path, parent.title),
      publishedScreen(
        "start/welcome/empty",
        "Empty",
        "unmodified",
        parent.path,
      ),
    ],
    removedEntries: [
      removedScreenVariant(removed, "Old", parent, ["Launchpad"]),
    ],
    tree: [
      {
        kind: "folder",
        path: "start",
        title: "Launchpad",
        children: [
          {
            kind: "entry",
            path: parent.path,
            children: [{ kind: "entry", path: "start/welcome/empty" }],
          },
        ],
      },
    ],
  });
  const catalogue = viewerCatalogue(model);
  const row = rows(catalogueNavSections(catalogue)).get(removed);
  assert.equal(row?.removedVariant, true);
  const entry = catalogue.byPath.get(parent.path);
  assert.ok(entry);
  const route: ShellRoute = {
    view: { kind: "target", target: { kind: "entry", entry } },
  };
  for (const [search, opens] of [
    ["removed", false],
    ["old", true],
    ["launchpad", true],
  ] as const) {
    const selection = { ...defaultSelection, view: "changes" as const, search };
    const changed = viewerContext(model, selection);
    assert.deepEqual(changed.changedEntries, [removed]);
    assert.equal(navLeafVisible(row!, selection, changed), opens, search);
    const activated = changesActivation(catalogue, changed, selection, route);
    assert.equal(
      activated.view.kind === "target" &&
        activated.view.target.entry.path === removed,
      opens,
      search,
    );
  }
});

test("a route reveal keeps a search that the destination's folder title matches", () => {
  const model = shellModelFixture();
  const catalogue = viewerCatalogue(model);
  const details = rows(catalogueNavSections(catalogue)).get(
    "product/browse/details",
  );
  const selected = {
    ...defaultSelection,
    screenPath: "product/browse/details",
    search: "overview",
  };
  assert.ok(details);
  assert.equal(navLeafVisible(details, selected, context), true);
  assert.deepEqual(
    revealSelection(model, folderTitleLookup(catalogue.hierarchy), selected),
    selected,
  );
  assert.equal(revealSelection(model, () => [], selected).search, "");
});
