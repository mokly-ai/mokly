import assert from "node:assert/strict";
import test from "node:test";

import { analyzeHierarchy } from "../src/registry/hierarchy.js";
import type { ManifestEntry, ManifestFolder } from "../src/registry/types.js";
import type { ShellContext } from "../src/shell/context.js";
import { structuredCrumbTrail } from "../src/shell/crumbs.js";
import {
  folderRevealPath,
  folderRevealSelection,
} from "../src/shell/nav_reveal.js";
import { buildNavSections } from "../src/shell/nav_tree.js";
import { defaultSelection } from "../src/viewer/selection.js";
import type { ViewerSelection } from "../src/viewer/types.js";

import { shellHierarchyFixture } from "./manifest_path_fixture.js";

const entry = (
  path: string,
  kind: string,
  title: string,
  variantOf?: string,
): ManifestEntry =>
  ({ path, kind, title, ...(variantOf ? { variantOf } : {}) }) as ManifestEntry;

const entries = [
  entry("guide", "page", "Guide"),
  entry("guide/setup/first", "screen", "First"),
  entry("guide/secret/plan", "screen", "Plan"),
  entry("billing/invoice", "screen", "Invoice"),
  entry("billing/invoice/overdue", "screen", "Overdue", "billing/invoice"),
  entry("billing/invoice/history", "screen", "History"),
  entry("billing/invoice/archive/old", "screen", "Old"),
  entry("kit/parts/chip", "component", "Chip"),
  entry("pruned/secret/plan", "screen", "Plan"),
];
const folders: ManifestFolder[] = [
  { path: "guide/secret", hidden: true, sourcePath: "specs/secret.ts" },
  { path: "pruned/secret", hidden: true, sourcePath: "specs/pruned.ts" },
];
const hierarchy = analyzeHierarchy(entries, folders).hierarchy;
const sections = buildNavSections(shellHierarchyFixture(hierarchy));

const context = (changedEntries: readonly string[]): ShellContext => ({
  base: "main",
  changedEntries,
  changesStatus: "ready",
  updateVersion: 1,
});
const select = (partial: Partial<ViewerSelection>): ViewerSelection => ({
  ...defaultSelection,
  ...partial,
});

test("folder crumbs link to the folder's own page, reveal plain folders, and keep hidden ones as text", () => {
  assert.deepEqual(
    structuredCrumbTrail(shellHierarchyFixture(hierarchy), "guide/setup/first"),
    [
      { href: "/view/guide/", label: "Guide" },
      { folder: { path: "guide/setup", section: "specs" }, label: "Setup" },
    ],
  );
  assert.deepEqual(
    structuredCrumbTrail(shellHierarchyFixture(hierarchy), "guide/secret/plan"),
    [{ href: "/view/guide/", label: "Guide" }, { label: "Secret" }],
  );
  assert.deepEqual(
    structuredCrumbTrail(shellHierarchyFixture(hierarchy), "guide"),
    [],
  );
  assert.deepEqual(
    structuredCrumbTrail(
      shellHierarchyFixture(hierarchy),
      "pruned/secret/plan",
    ),
    [{ label: "Pruned" }, { label: "Secret" }],
  );
});

test("crumbs under a screen index use its title and link, and components reveal their own section", () => {
  assert.deepEqual(
    structuredCrumbTrail(
      shellHierarchyFixture(hierarchy),
      "billing/invoice/history",
    ),
    [
      { folder: { path: "billing", section: "specs" }, label: "Billing" },
      { href: "/view/billing/invoice/", label: "Invoice" },
    ],
  );
  assert.deepEqual(
    structuredCrumbTrail(
      shellHierarchyFixture(hierarchy),
      "billing/invoice/overdue",
    ),
    [{ folder: { path: "billing", section: "specs" }, label: "Billing" }],
  );
  assert.deepEqual(
    structuredCrumbTrail(shellHierarchyFixture(hierarchy), "kit/parts/chip"),
    [
      { folder: { path: "kit", section: "components" }, label: "Kit" },
      { folder: { path: "kit/parts", section: "components" }, label: "Parts" },
    ],
  );
});

test("revealing a folder opens its section, ancestors, and any list it is listed in", () => {
  assert.deepEqual(
    folderRevealPath(sections, "specs", "billing/invoice/archive")?.keys,
    [
      "section:specs",
      "folder:specs:billing",
      "variants:billing/invoice",
      "folder:specs:billing/invoice/archive",
    ],
  );
  assert.deepEqual(
    folderRevealPath(sections, "components", "kit/parts")?.keys,
    [
      "section:components",
      "folder:components:kit",
      "folder:components:kit/parts",
    ],
  );
  assert.equal(folderRevealPath(sections, "specs", "kit/parts"), undefined);
  assert.equal(
    folderRevealPath(sections, "specs", "billing/invoice"),
    undefined,
  );
});

test("a reveal clears only the filters that hide the folder", () => {
  const archive = folderRevealPath(
    sections,
    "specs",
    "billing/invoice/archive",
  );
  assert.ok(archive);
  const matching = select({ search: "old" });
  assert.equal(
    folderRevealSelection(archive.node, matching, context([])),
    matching,
  );
  assert.deepEqual(
    folderRevealSelection(
      archive.node,
      select({ search: "zzz", tags: ["forms"] }),
      context([]),
    ),
    select({ search: "", tags: [] }),
  );
  const changed = select({ view: "changes" });
  assert.equal(
    folderRevealSelection(
      archive.node,
      changed,
      context(["billing/invoice/archive/old"]),
    ),
    changed,
  );
  assert.deepEqual(
    folderRevealSelection(
      archive.node,
      select({ view: "changes", search: "old" }),
      context(["guide/setup/first"]),
    ),
    select({ view: "all", search: "old" }),
  );
});

test("a reveal clears the search when it and Changes hide the folder only together", () => {
  const billing = folderRevealPath(sections, "specs", "billing");
  assert.ok(billing);
  assert.deepEqual(
    folderRevealSelection(
      billing.node,
      select({ view: "changes", search: "history" }),
      context(["billing/invoice/archive/old"]),
    ),
    select({ view: "changes", search: "", tags: [] }),
  );
  const secret = folderRevealPath(sections, "specs", "guide/secret");
  assert.ok(secret);
  assert.deepEqual(
    folderRevealSelection(
      secret.node,
      select({ view: "changes", search: "zzz" }),
      context([]),
    ),
    undefined,
  );
});

test("a reveal that no filter change can complete returns no selection", () => {
  const pruned = folderRevealPath(sections, "specs", "pruned");
  assert.ok(pruned);
  for (const selection of [
    select({}),
    select({ search: "zzz", tags: ["forms"] }),
    select({ view: "changes", search: "zzz" }),
  ])
    assert.equal(
      folderRevealSelection(pruned.node, selection, context([])),
      undefined,
    );
});
