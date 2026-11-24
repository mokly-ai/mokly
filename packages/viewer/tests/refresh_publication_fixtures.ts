import assert from "node:assert/strict";
import type { TestContext } from "node:test";

import type {
  CatalogueReadModel,
  CatalogueUsage,
  EntryDetailV4,
} from "@mokly/model";

import type { DetailRequest } from "../src/catalogue/detail_fences.js";
import {
  initialSnapshot,
  shellStateWithCatalogue,
  type ShellDataSnapshot,
} from "../src/shell/data_commit.js";
import { ShellDataController } from "../src/shell/data_controller.js";
import { shellContext } from "../src/shell/projection.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { defaultSelection } from "../src/shell/selection.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import type { ShellState } from "../src/shell/store_state.js";

import { detailFixture, indexFixture } from "./catalogue_v9_fixture.js";
import { FakeDataSource, flush } from "./data_fakes.js";

export const ORIGIN = "https://catalogue.test";
export const HOME = "product/browse/home";
export const HOME_URL = `/view/${HOME}/`;
export const RETIRED = {
  path: "product/browse/home/retired",
  snapshotId:
    "9222f823b4a0d8a23e201436f42c7d624b675f318bc496b635d18fb9f5a4806e",
};
export const DOCUMENT_KEY = "c".repeat(64);
export const USAGE_DETAIL_ID = "d".repeat(64);
export const LIVE_GENERATION = "a".repeat(64);

export type DetailPair = readonly [DetailRequest, EntryDetailV4];

export function publication(
  revision: number,
  edit?: (index: CatalogueReadModel) => void,
): CatalogueReadModel {
  return indexFixture((index) => {
    index.revision = revision;
    index.live = { generation: LIVE_GENERATION };
    edit?.(index);
  });
}

export function homeScreen(index: CatalogueReadModel) {
  return index.screens.find(({ path }) => path === HOME)!;
}

export function homeDetail(
  revision: number,
  edit?: (detail: EntryDetailV4) => void,
): DetailPair {
  const request = { path: HOME };
  const detail = detailFixture(request);
  detail.revision = revision;
  edit?.(detail);
  return [request, detail];
}

export function changeHomeUsage(detail: EntryDetailV4): void {
  const usage: CatalogueUsage = { status: "pending" };
  detail.detailId = USAGE_DETAIL_ID;
  detail.views[0]!.usage = usage;
}

export async function publish(
  source: FakeDataSource,
  index: CatalogueReadModel,
  details: readonly DetailPair[] = [],
): Promise<void> {
  source.live!.listener!.message(index.revision, index.deploymentId);
  source.index().resolve(index);
  await flush();
  for (const [request, detail] of details)
    source.detail(request.path, request.snapshotId).resolve(detail);
  await flush();
}

export function initialShellState(
  snapshot: ShellDataSnapshot,
  path: string = HOME_URL,
) {
  return createInitialShellState(
    snapshot.catalogue,
    shellContext(snapshot.catalogue.publicModel, defaultSelection),
    routeFromUrl(snapshot.catalogue, new URL(path, ORIGIN)),
    undefined,
  );
}

export function followPublications(t: TestContext, path = HOME_URL) {
  const source = new FakeDataSource(true);
  const initial = initialSnapshot(publication(0));
  const startingState: ShellState = {
    ...initialShellState(initial, path),
    navScroll: 48,
    sheet: "panel",
    sheetExpanded: true,
  };
  let state = startingState;
  const commits: number[] = [];
  const controller = new ShellDataController(initial, source, {
    prepare(next) {
      const rebound = shellStateWithCatalogue(state, next.catalogue);
      return () => {
        state = rebound;
        commits.push(next.index.revision);
      };
    },
    route: () => state.route,
    versionError: (error) => assert.fail(error.message),
    warn: (message) => assert.fail(message),
  });
  t.after(controller.connect());
  return {
    commits,
    controller,
    source,
    state: () => state,
    matchesRebuild(index: CatalogueReadModel, ...details: DetailPair[]) {
      const rebuilt = initialSnapshot(
        structuredClone(index),
        structuredClone(details),
      );
      assert.deepStrictEqual(
        snapshotValues(controller.snapshot),
        snapshotValues(rebuilt),
      );
      assert.deepStrictEqual(
        state,
        shellStateWithCatalogue(startingState, rebuilt.catalogue),
      );
      assert.deepStrictEqual([...controller.failed], []);
      assert.equal(controller.refreshFailed, undefined);
    },
  };
}

function snapshotValues({ index, details, catalogue }: ShellDataSnapshot) {
  const { hierarchy, byPath, previousPaths, publicModel, ...rest } = catalogue;
  const {
    ancestorsByPath,
    byPath: hierarchyByPath,
    variantParentByPath,
    variantsByPath,
    ...tree
  } = hierarchy;
  return {
    index,
    details: [...details],
    catalogue: {
      ...rest,
      publicModel: { ...publicModel, details: [...publicModel.details] },
      byPath: [...byPath],
      previousPaths: [...previousPaths],
      hierarchy: {
        ...tree,
        ancestorsByPath: [...ancestorsByPath],
        byPath: [...hierarchyByPath],
        variantParentByPath: [...variantParentByPath],
        variantsByPath: [...variantsByPath],
      },
    },
  };
}
