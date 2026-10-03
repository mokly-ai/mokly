import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../packages/viewer/dist/components/manifest_types.js";
import type { ManifestEntry } from "../packages/viewer/dist/registry/types.js";
import type { ComponentReview } from "../packages/viewer/dist/review/component_types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import type { ShellContext } from "../packages/viewer/dist/shell/context.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence.js";
import { workspaceVariants } from "../packages/viewer/dist/shell/workspace_variants.js";

const unmodified = {
  base: "main",
  status: "Unmodified",
  components: [],
  comparisonEligible: false,
  comparisons: true,
  entry: { path: "account/receipt", kind: "screen" },
  inputChanges: [],
  relatedComponents: [],
  usedBy: [],
  affected: [],
  removed: false,
  variants: [],
  views: [],
} as unknown as WorkspaceData;

test("a moved entry's comparison details name the path its earlier side comes from", () => {
  const moved = renderToStaticMarkup(
    createElement(WorkspaceEvidence, {
      data: unmodified,
      previousPath: "billing/receipt",
    }),
  );
  assert.match(
    moved,
    /<p>Compared with the branch point on main\.<\/p><p>The previous version is at <code class="mbk-code">billing\/receipt<\/code>, where it was before the move\.<\/p><p>No changes to this screen\.<\/p><\/section>$/u,
  );
  const stayed = renderToStaticMarkup(
    createElement(WorkspaceEvidence, { data: unmodified }),
  );
  assert.doesNotMatch(stayed, /before the move/u);
});

const component = (path: string, variantOf?: string) =>
  ({
    colorSchemes: ["light"],
    controls: [],
    declaredDependencies: [],
    description: path,
    kind: "component",
    ownedDependencies: [],
    path,
    propSchema: { properties: {}, type: "object" },
    props: {},
    relatedDocs: [],
    slots: [],
    sourcePath: `src/${path}.mokly.tsx`,
    suppliedSlots: [],
    tags: [],
    title: path,
    views: [],
    ...(variantOf ? { variantOf } : {}),
  }) as unknown as ManifestEntry;

test("a moved component keeps its removed and baseline variants and a pure-moved variant stays unmodified", () => {
  const parent = component("ui/action");
  const primary = component("ui/action/primary", "ui/action");
  const disabled = component("action/disabled", "action");
  const catalogue = createCatalogue(
    {
      entries: [parent, primary],
      folders: [],
      generatedBy: "mokly",
      schemaVersion: 8,
      sourceFiles: [],
    },
    [{ entry: disabled, folderTitles: [] }],
    [
      { path: "ui/action", previousPath: "action" },
      { path: "ui/action/primary", previousPath: "action/primary" },
    ],
  );
  const baselinePrimary = component("action/primary", "action");
  const snapshot = {
    baseline: { entries: [component("action"), baselinePrimary, disabled] },
  } as unknown as NonNullable<ShellContext["componentChanges"]>;
  const review = (state: "changed" | "unchanged") =>
    ({
      variants: [
        {
          path: "ui/action/primary",
          previousPath: "action/primary",
          state,
          title: "Primary",
          views: [],
        },
      ],
    }) as unknown as ComponentReview;
  const changed = ["ui/action", "ui/action/primary", "action/disabled"];
  const statuses = (state: "changed" | "unchanged") => {
    const set = workspaceVariants(
      catalogue,
      parent as ManifestComponent,
      snapshot,
      review(state),
      true,
      false,
      undefined,
      changed,
    );
    return {
      baseline: set.baseline.map(
        (variant: ManifestComponentVariant) => variant.path,
      ),
      rows: set.rows.map((row) => [row.value.path, row.status, row.removed]),
    };
  };
  assert.deepEqual(statuses("unchanged"), {
    baseline: ["action/primary", "action/disabled"],
    rows: [
      ["ui/action/primary", "Unmodified", false],
      ["action/disabled", "Removed", true],
    ],
  });
  assert.deepEqual(statuses("changed").rows[0], [
    "ui/action/primary",
    "Changed",
    false,
  ]);
});
