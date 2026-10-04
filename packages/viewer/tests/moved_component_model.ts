/** The protocol read model after its Action component moved under `ui`. */

import fs from "node:fs";

import { readCatalogue } from "../src/catalogue/reader.js";
import type { CatalogueReadModel } from "../src/catalogue/types.js";

const fixture = new URL(
  "../../../docs/protocol/fixtures/catalogue-v4.json",
  import.meta.url,
);

const READY = { status: "ready" } as const;

/**
 * `components/action` moved to `ui/action` without other edits. Primary moved
 * with it unchanged, Ghost moved and changed only its description, and
 * Secondary was deleted on the way, so its removed record still names the
 * parent's previous path.
 */
export function movedComponentModel(): CatalogueReadModel {
  const model = JSON.parse(fs.readFileSync(fixture, "utf8"));
  const [parent, variant] = model.components;
  const moved = (slug: string, title: string, kind: string) => ({
    ...structuredClone(variant),
    path: `ui/action/${slug}`,
    previousPath: `components/action/${slug}`,
    title,
    variantOf: "ui/action",
    changes: { ...READY, included: true, kind },
    comparison: { ...READY, eligible: false, kind: "unmodified" },
  });
  const removed = { ...READY, eligible: true, kind: "removed" };
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
      views: variant.views.map((view: object) => ({
        ...view,
        comparison: removed,
      })),
    },
    folderTitles: ["Components"],
  });
  model.tree[0] = {
    children: [
      {
        children: ["primary", "ghost"].map((slug) => ({
          kind: "entry",
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
  return readCatalogue(model);
}
