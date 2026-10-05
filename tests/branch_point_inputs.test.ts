import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestEntry } from "../packages/viewer/src/registry/types.js";
import type { ReviewResultV5 } from "../packages/viewer/src/review/component_types.js";
import type { ShellContext } from "../packages/viewer/src/shell/context.js";
import { workspaceData } from "../packages/viewer/src/shell/workspace_data.js";
import { affectedUsageLinks } from "../packages/viewer/src/shell/workspace_usage_data.js";

import {
  lookupCatalogue,
  lookupComponent,
  lookupScreen,
} from "./helpers/branch_point_lookup.js";

/** Light views whose entry supplies one `glyph` instance of `componentId`. */
function glyphViews(componentId: string, name: string) {
  return (["mobile", "desktop"] as const).map((viewport) => ({
    viewport,
    colorScheme: "light" as const,
    instances: [
      {
        componentId,
        id: "glyph",
        key: "a".repeat(64),
        order: 0,
        owner: { kind: "entry" as const },
        props: { name: ["string", name] as const },
        propsKey: name,
      },
    ],
    ranges: [],
    resources: [],
    slots: [],
    styles: [],
  }));
}

function variant(path: string, parent: string, glyph?: [string, string]) {
  return {
    ...lookupComponent(path),
    variantOf: parent,
    props: {},
    suppliedSlots: glyph ? ["children"] : [],
    componentViews: glyph ? glyphViews(...glyph) : [],
  } as unknown as ManifestEntry;
}

function context(
  baseline: readonly ManifestEntry[],
  changed: readonly string[],
): ShellContext {
  return {
    base: "main",
    changedEntries: changed,
    componentChanges: {
      baseline: { entries: baseline },
      changedEntries: changed,
    } as unknown as NonNullable<ShellContext["componentChanges"]>,
    updateVersion: 0,
  };
}

const cases = [
  {
    label: "a variant moved between surviving parents",
    selected: "lib/receiver/iconic",
    baseline: [
      lookupComponent("lib/donor"),
      variant("lib/donor/iconic", "lib/donor", ["lib/icon", "arrow"]),
      variant("lib/donor/spare", "lib/donor"),
      lookupComponent("lib/receiver"),
      variant("lib/receiver/default", "lib/receiver"),
      lookupComponent("lib/icon"),
    ],
    current: [
      lookupComponent("lib/donor"),
      variant("lib/donor/spare", "lib/donor"),
      lookupComponent("lib/receiver"),
      variant("lib/receiver/default", "lib/receiver"),
      variant("lib/receiver/iconic", "lib/receiver", ["lib/icon", "chevron"]),
      lookupComponent("lib/icon"),
    ],
    moves: [{ path: "lib/receiver/iconic", previousPath: "lib/donor/iconic" }],
  },
  {
    label:
      "case-only renames of a parent, its variant and the supplied component",
    selected: "lib/action/iconic",
    baseline: [
      lookupComponent("lib/Action"),
      variant("lib/Action/Iconic", "lib/Action", ["lib/Icon", "arrow"]),
      lookupComponent("lib/Icon"),
    ],
    current: [
      lookupComponent("lib/action"),
      variant("lib/action/iconic", "lib/action", ["lib/icon", "chevron"]),
      lookupComponent("lib/icon"),
    ],
    moves: [],
  },
];

for (const current of cases)
  test(`supplied inputs pair across ${current.label}`, () => {
    const catalogue = lookupCatalogue(current.current, [], current.moves);
    const entry = catalogue.byPath.get(current.selected);
    assert.ok(entry?.kind === "component");
    const data = workspaceData(
      catalogue,
      context(current.baseline, [current.selected]),
      entry,
    );
    assert.deepEqual(
      data.inputChanges.map((change) => [
        change.variantPath,
        change.viewport,
        change.title,
        change.before,
        change.after,
      ]),
      (["mobile", "desktop"] as const).map((viewport) => [
        current.selected,
        viewport,
        "lib/icon",
        { name: ["string", "arrow"] },
        { name: ["string", "chevron"] },
      ]),
    );
  });

test("affected evidence resolves each side and omits a before path another kind reuses", () => {
  const document = {
    ...lookupScreen("shop/receipt"),
    kind: "document",
    resources: [],
  } as unknown as ManifestEntry;
  const legacy = lookupScreen("shop/legacy");
  const catalogue = lookupCatalogue(
    [lookupComponent("lib/badge"), document, lookupScreen("shop/order")],
    [{ entry: legacy, folderTitles: ["Shop"], snapshotId: "b".repeat(64) }],
  );
  const evidence = (side: "before" | "after", path: string, key: string) => ({
    side,
    context: {
      kind: "screen",
      entry: { path, title: path },
      viewport: "mobile",
      colorScheme: "light",
    },
    via: [{ componentId: "lib/badge", instanceKey: key }],
  });
  const result = {
    affectedConsumers: [
      {
        changedComponentId: "lib/badge",
        consumer: { kind: "screen", path: "shop/order" },
        evidence: [
          evidence("before", "shop/receipt", "k1"),
          evidence("after", "shop/receipt", "k2"),
          evidence("before", "SHOP/Order", "k3"),
          evidence("after", "shop/order", "k4"),
          evidence("before", "shop/legacy", "k5"),
          evidence("after", "shop/legacy", "k6"),
        ],
      },
    ],
  } as unknown as ReviewResultV5;
  assert.deepEqual(
    affectedUsageLinks(catalogue, result, "lib/badge").map((link) => [
      link.entryId,
      link.title,
      link.removed,
      link.instanceKey,
    ]),
    [
      ["shop/order", "shop/order", false, "k3"],
      ["shop/order", "shop/order", false, "k4"],
      ["shop/legacy", "shop/legacy", true, "k5"],
    ],
  );
});
