/** The protocol index after its Action component moved under `ui`. */

import assert from "node:assert/strict";

import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import type { ShellCatalogueReadModel } from "../src/catalogue/scoped_types.js";
import type { CatalogueComponent, ChangeKind } from "../src/catalogue/types.js";

import { rawIndexFixture, shellModelFixture } from "./catalogue_v8_fixture.js";

const READY = { status: "ready" } as const;

/**
 * `components/action` moved to `ui/action` without other edits. Primary moved
 * with it unchanged, Ghost moved and changed only its description, and
 * Secondary was deleted on the way, so its removed record still names the
 * parent's previous path. No assertion reads view usage, so the shell holds
 * no entry detail.
 */
export function movedComponentModel(): ShellCatalogueReadModel {
  const model = rawIndexFixture();
  const [parent, variant] = model.components;
  assert.ok(parent && variant);
  const moved = (
    slug: string,
    title: string,
    kind: ChangeKind,
  ): CatalogueComponent => ({
    ...structuredClone(variant),
    path: `ui/action/${slug}`,
    previousPath: `components/action/${slug}`,
    title,
    variantOf: "ui/action",
    changes: { ...READY, included: true, kind },
    comparison: { ...READY, eligible: false, kind: "unmodified" },
  });
  const removed = { ...READY, eligible: true, kind: "removed" } as const;
  model.components = [
    {
      ...parent,
      path: "ui/action",
      previousPath: "components/action",
      changes: { ...READY, included: true, kind: "unmodified" },
    },
    moved("primary", "Primary", "unmodified"),
    moved("ghost", "Ghost", "changed"),
  ];
  model.removedEntries.push({
    entry: {
      ...structuredClone(variant),
      path: "components/action/secondary",
      title: "Secondary",
      changes: { ...READY, included: true, kind: "removed" },
      comparison: removed,
      views: variant.views.map((view) => ({ ...view, comparison: removed })),
    },
    folderTitles: ["Components"],
    parentTitle: parent.title,
    snapshotId: "d".repeat(64),
  });
  model.tree[0] = {
    children: [
      {
        children: ["primary", "ghost"].map((slug) => ({
          kind: "entry" as const,
          path: `ui/action/${slug}`,
        })),
        kind: "entry",
        path: "ui/action",
      },
    ],
    kind: "folder",
    path: "ui",
    title: "UI",
  };
  return shellModelFixture(readCatalogueIndex(model), new Map());
}
