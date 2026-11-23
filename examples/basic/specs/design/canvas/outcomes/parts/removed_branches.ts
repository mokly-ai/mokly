import type { NavNode } from "../../../parts/nav.js";
import { CHANGED_COUNT } from "../../../parts/nav_data.js";
import { REMOVED_VARIANT_ROWS } from "../../../parts/variant_nav_data.js";
import type { CatalogueView } from "../../parts/catalogue.js";
import { CANVAS_PAGES as C } from "../../parts/destinations.js";
import { changePosition } from "../../parts/nav_rows.js";
import type { PanelTab } from "../../parts/panel.js";

import { OUTCOME_PAGES as O, type OutcomeDestination } from "./destinations.js";
import {
  LIGHT_ONLY_RECORD,
  REMOVED_PAGE_RECORDS,
  REMOVED_SCREEN_RECORDS,
  REMOVED_VARIANT_RECORD,
  type RemovedRecord,
} from "./removed_entries.js";
import type { RemovedStep } from "./removed_panel.js";

/*
 * The removed entries stand on four branches. The canonical branch removed
 * five screens, which its Changes filter lists last, after the moved
 * entries: Farewell, Survey, Invite, Archive and Timeline. The handbook
 * branch removed the Handbook folder with its four pages, which its Changes
 * filter lists flat, because their folder is gone. Two branches of their own
 * removed one entry each: Welcome's saved variant Save failed, which stays
 * under its surviving parent, and the Payment terms document, after the
 * catalogue enabled Dark. On a branch of its own, a row opens an artboard of
 * that branch, and every other row is a picture.
 */

/** A removed screen's step on the canonical branch, between its neighbours. */
function canonicalStep(
  record: RemovedRecord,
  previous?: OutcomeDestination,
  next?: OutcomeDestination,
): RemovedStep {
  return {
    position: changePosition(record.key),
    total: CHANGED_COUNT,
    previous,
    next,
  };
}

const { archive, farewell, invite, survey } = REMOVED_SCREEN_RECORDS;

/**
 * The steps of the canonical branch's removed screens on their Changes tab.
 * Payment terms, before Farewell, and Timeline, after Archive, have no
 * Changes artboard, so those controls are pictures.
 */
export const CANONICAL_STEPS = {
  farewell: canonicalStep(farewell, undefined, O.removedLong),
  survey: canonicalStep(survey, O.removed, O.removedLoading),
  invite: canonicalStep(invite, O.removedLong, O.removedUnavailable),
  archive: canonicalStep(archive, O.removedLoading),
} as const satisfies Record<string, RemovedStep>;

/**
 * The canonical branch in the Changes filter with a removed screen selected.
 * A row keeps the right panel's tab where its entry has an artboard on that
 * tab: on the Changes tab, Welcome and Details open their Changes artboards;
 * on Inspect, the Example tour, Invoice and Farewell open theirs on Inspect.
 */
export function canonicalRemoved(
  record: RemovedRecord,
  tab: PanelTab,
): CatalogueView {
  return {
    filter: "changes",
    activeKey: record.key,
    targets:
      tab === "changes"
        ? { welcome: C.changesCurrent, details: C.addedChanges }
        : {
            "example/tour": C.useCase,
            invoice: C.movedInspect,
            [farewell.key]: O.removedInspect,
          },
  };
}

/** The artboard of each removed page, in the handbook branch's order. */
const PAGE_ARTBOARDS = [
  [REMOVED_PAGE_RECORDS.gettingStarted, O.removedDocument],
  [REMOVED_PAGE_RECORDS.fieldGuide, O.removedDocumentLong],
  [REMOVED_PAGE_RECORDS.printingTips, O.removedDocumentLoading],
  [REMOVED_PAGE_RECORDS.styleNotes, O.removedDocumentUnavailable],
] as const;

/** The handbook branch's four flat rows, each opening its artboard. */
const HANDBOOK_ROWS: readonly NavNode[] = PAGE_ARTBOARDS.map(
  ([record, to]) => ({
    key: record.key,
    depth: 0,
    kind: "page" as const,
    label: `${record.entry.title} · Removed`,
    to,
  }),
);

/** The handbook branch in the Changes filter with a removed page selected. */
export function handbookRemoved(record: RemovedRecord): CatalogueView {
  return {
    filter: "changes",
    activeKey: record.key,
    rows: HANDBOOK_ROWS,
    changedCount: HANDBOOK_ROWS.length,
  };
}

/**
 * A removed page's step on the handbook branch: each page's Changes
 * artboard opens its neighbour's, and the first and the last page end the
 * list.
 */
export function handbookStep(record: RemovedRecord): RemovedStep {
  const index = PAGE_ARTBOARDS.findIndex(([page]) => page === record);
  return {
    position: index + 1,
    total: PAGE_ARTBOARDS.length,
    previous: PAGE_ARTBOARDS[index - 1]?.[1],
    next: PAGE_ARTBOARDS[index + 1]?.[1],
  };
}

/** The branch that removed Payment terms: its one row, selected. */
export const LIGHT_ONLY_CHANGES: CatalogueView = {
  filter: "changes",
  activeKey: LIGHT_ONLY_RECORD.key,
  rows: [
    {
      key: LIGHT_ONLY_RECORD.key,
      depth: 0,
      kind: "document",
      label: `${LIGHT_ONLY_RECORD.entry.title} · Removed`,
    },
  ],
  changedCount: 1,
};

/**
 * The branch that removed Save failed: the Removed row under Welcome, which
 * keeps the aggregate mark, selected. The deletion is a later state of the
 * same group, so Welcome's row is a picture.
 */
export const VARIANT_CHANGES: CatalogueView = {
  filter: "changes",
  activeKey: REMOVED_VARIANT_RECORD.key,
  rows: REMOVED_VARIANT_ROWS,
  changedCount: 1,
};

/** The one change of a branch of its own: both stepper controls end it. */
export const ONLY_STEP: RemovedStep = { position: 1, total: 1 };
