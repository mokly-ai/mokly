/**
 * Details show only the reasons that fit their record (decisions 1 and 6 of
 * the round's D1 review): a record outside Changes shows none, and a reason
 * that contradicts its record is dropped while the detail still loads.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { detailKey } from "../src/catalogue/detail_fences.js";
import type { ShellCatalogueRoutedEntry } from "../src/catalogue/scoped_types.js";
import type { CatalogueReadModel } from "../src/catalogue/types.js";
import type { EntryChangeReason } from "../src/review/types.js";
import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";
import { viewerCatalogue } from "../src/viewer/projection.js";
import { shownReasons } from "../src/viewer/public_reasons.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";

import {
  detailPairs,
  indexFixture,
  rawDetailFixtures,
  shellModelFixture,
} from "./catalogue_v9_fixture.js";

const HOME = "product/browse/home";
const ACTION = "components/action";
const VARIANT = "components/action/default";
const RETIRED = "product/browse/home/retired";

const every: EntryChangeReason[] = [
  { kind: "added" },
  { kind: "dependency", path: "static/a.css" },
  { kind: "implementation" },
  { kind: "inputs" },
  { kind: "material" },
  { kind: "metadata" },
  { kind: "removed" },
  { kind: "screen", screenPath: HOME },
  { kind: "structure" },
];
const kinds = (reasons: readonly EntryChangeReason[] | undefined) =>
  reasons?.map((reason) => reason.kind);

/** The index fixture with these records ready and included as `changed`. */
function includedIndex(...paths: string[]): CatalogueReadModel {
  return indexFixture((raw) => {
    for (const entry of [...raw.components, ...raw.useCases])
      if (paths.includes(entry.path))
        entry.changes = { status: "ready", kind: "changed", included: true };
  });
}

function record(
  index: CatalogueReadModel,
  path: string,
): ShellCatalogueRoutedEntry {
  const model = shellModelFixture(index);
  const found = [
    ...model.screens,
    ...model.components,
    ...model.pages,
    ...model.documents,
    ...model.useCases,
    ...model.removedEntries.map(({ entry }) => entry),
  ].find((entry) => entry.path === path);
  assert.ok(found, path);
  return found;
}

test("a reason that contradicts its record is dropped", () => {
  const index = includedIndex(ACTION, VARIANT, "tour");
  const shared = ["dependency", "inputs", "material", "metadata", "structure"];
  // A current changed screen: no removal, no addition, no use-case or
  // component-parent reason.
  assert.deepEqual(
    kinds(shownReasons(record(index, HOME), false, every)),
    shared,
  );
  assert.deepEqual(kinds(shownReasons(record(index, ACTION), false, every)), [
    "dependency",
    "implementation",
    "inputs",
    "material",
    "metadata",
    "structure",
  ]);
  assert.deepEqual(
    kinds(shownReasons(record(index, VARIANT), false, every)),
    shared,
  );
  // The document is added on this branch, and the use case may name screens.
  assert.deepEqual(
    kinds(shownReasons(record(index, "product"), false, every)),
    ["added", ...shared],
  );
  assert.deepEqual(kinds(shownReasons(record(index, "tour"), false, every)), [
    ...shared.slice(0, 4),
    "screen",
    "structure",
  ]);
  assert.deepEqual(kinds(shownReasons(record(index, RETIRED), true, every)), [
    ...shared.slice(0, 4),
    "removed",
    "structure",
  ]);
});

test("a record outside Changes, or a detail without reasons, shows none", () => {
  const index = indexFixture();
  assert.equal(shownReasons(record(index, ACTION), false, every), undefined);
  assert.equal(shownReasons(record(index, HOME), false, undefined), undefined);
  assert.deepEqual(shownReasons(record(index, HOME), false, []), []);
});

test("Details keep the detail but not its contradicting reason", () => {
  const fixtures = rawDetailFixtures();
  fixtures.current[HOME]!.reasons = [{ kind: "material" }, { kind: "removed" }];
  const model = shellModelFixture(
    indexFixture(),
    new Map(
      detailPairs(undefined, fixtures).map(([request, detail]) => [
        detailKey(request),
        detail,
      ]),
    ),
  );
  const catalogue = viewerCatalogue(model);
  const entry = catalogue.byPath.get(HOME);
  assert.ok(entry?.kind === "screen");
  const data = publicWorkspace(
    catalogue,
    model,
    entry,
    true,
    undefined,
    "main",
  );
  assert.deepEqual(data.reasons, [{ kind: "material" }]);
  const markup = renderToStaticMarkup(<WorkspaceEvidence data={data} />);
  assert.match(markup, /<p class="mbk-reset">Rendered content changed\.<\/p>/);
  assert.doesNotMatch(markup, /Removed on this branch/);
});
