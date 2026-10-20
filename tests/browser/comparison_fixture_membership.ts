import { expect } from "@playwright/test";

import type { CatalogueReadModel } from "@mokly/viewer";

import { comparisonPaths as paths } from "../helpers/comparison_catalogue.js";
import { similarTextPageBase } from "../helpers/comparison_evidence_groups.js";
import {
  movedFixturePairs,
  movedFixturePaths as moves,
} from "../helpers/moved_fixture_sources.js";

const state = (included: boolean, kind: string) => ({
  status: "ready",
  included,
  kind,
});
const stable = state(false, "unmodified");
const moved = state(true, "unmodified");
const changed = state(true, "changed");

/** The default fixture's established classifications also hold in Serve. */
const defaultStates = {
  [paths.added]: state(true, "added"),
  [paths.changed]: changed,
  [paths.consumer]: stable,
  [paths.darkOnly]: changed,
  [paths.unchanged]: stable,
  [paths.component]: changed,
  [paths.changedVariant]: changed,
  [paths.addedVariant]: state(true, "added"),
  [paths.quietParent]: stable,
  [paths.quietSibling]: stable,
  [paths.quietVariant]: changed,
  [paths.changedPage]: changed,
  [paths.unchangedPage]: stable,
  [paths.similarTextPage]: changed,
  [paths.pageComponent]: changed,
  [paths.consumingComponent]: stable,
};

/** All current paths supplied by the two additive source hooks. */
const branchStates = {
  "branch/consumers/badge": changed,
  "branch/consumers/badge/default": changed,
  "branch/consumers/archive/status": changed,
  "branch/consumers/archive/status/default": changed,
  "branch/consumers/archive/receipt": changed,
  "branch/parent/archive/action": moved,
  "branch/parent/archive/action/primary": changed,
  "branch/variant/donor": stable,
  "branch/variant/donor/spare": stable,
  "branch/variant/receiver": stable,
  "branch/variant/receiver/default": stable,
  "branch/variant/receiver/primary": changed,
  "branch/case/action": changed,
  "branch/case/action/primary": changed,
  "branch/case/receipt": changed,
  "branch/reused/action": state(true, "added"),
  [moves.pureMovedScreen]: moved,
  [moves.movedAction]: moved,
  [moves.unchangedMovedVariant]: moved,
  [moves.metadataMovedVariant]: changed,
  [moves.nestedMovedVariant]: changed,
  [moves.movedInvoice]: changed,
  [moves.keptInvoiceVariant]: moved,
  [moves.movedPage]: moved,
  [moves.moveIcon]: stable,
  [moves.moveRing]: stable,
};

const branchPairs = [
  ["branch/consumers/archive/status", "branch/consumers/status"],
  [
    "branch/consumers/archive/status/default",
    "branch/consumers/status/default",
  ],
  ["branch/consumers/archive/receipt", "branch/consumers/receipt"],
  ["branch/parent/archive/action", "branch/parent/action"],
  ["branch/parent/archive/action/primary", "branch/parent/action/primary"],
  ["branch/variant/receiver/primary", "branch/variant/donor/primary"],
  ...movedFixturePairs,
  // The default copy's page pairs with its base path by similar text.
  [paths.similarTextPage, similarTextPageBase],
];
const removedPaths = [
  paths.removedScreen,
  paths.removedLightOnly,
  paths.removedPage,
  paths.removedDocument,
  paths.removedComponent,
  paths.removedVariant,
  paths.screenRemovedVariant,
  paths.quietRemoved,
  "branch/parent/action/secondary",
  "branch/case/Action/secondary",
  "branch/reused/action/default",
  moves.removedActionVariant,
  moves.removedInvoiceVariant,
];

/** Pin memberships and moves independently of the viewer's UI assertions. */
export function expectComparisonFixture(index: CatalogueReadModel): void {
  expect(index.changesStatus).toBe("ready");
  const current = [
    ...index.screens,
    ...index.components,
    ...index.pages,
    ...index.documents,
    ...index.useCases,
  ];
  const classifications = Object.fromEntries(
    current.map((entry) => [entry.path, entry.changes]),
  );
  expect(classifications).toMatchObject(defaultStates);
  expect(
    Object.fromEntries(
      current
        .filter((entry) => entry.path.startsWith("branch/"))
        .map((entry) => [entry.path, entry.changes]),
    ),
  ).toEqual(branchStates);
  expect(
    Object.fromEntries(
      current
        .filter((entry) => entry.previousPath !== undefined)
        .map((entry) => [entry.path, entry.previousPath]),
    ),
  ).toEqual(Object.fromEntries(branchPairs));
  expect(
    index.removedEntries.map((record) => record.entry.path).sort(),
  ).toEqual([...removedPaths].sort());
  for (const removed of index.removedEntries)
    expect(removed.entry.changes).toEqual(state(true, "removed"));
}
