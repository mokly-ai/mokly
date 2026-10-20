import fs from "node:fs";

import { detailKey } from "../../packages/viewer/dist/catalogue/detail_fences.js";
import { readEntryDetail } from "../../packages/viewer/dist/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../../packages/viewer/dist/catalogue/index_reader.js";
import type { ShellCatalogueReadModel } from "../../packages/viewer/dist/catalogue/scoped_types.js";
import { shellCatalogueModel } from "../../packages/viewer/dist/catalogue/shell_model.js";
import type {
  CatalogueReadModel,
  EntryDetailV2,
} from "../../packages/viewer/dist/catalogue/types.js";
import { routeFromUrl } from "../../packages/viewer/dist/shell/routes.js";
import { createInitialShellState } from "../../packages/viewer/dist/shell/store_initial.js";
import type {
  ShellInitialState,
  ShellState,
} from "../../packages/viewer/dist/shell/store_state.js";
import {
  viewerCatalogue,
  viewerContext,
} from "../../packages/viewer/dist/viewer/projection.js";
import { defaultSelection } from "../../packages/viewer/dist/viewer/selection.js";

function fixtureJson(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(
      new URL(`../../docs/protocol/fixtures/${name}`, import.meta.url),
      "utf8",
    ),
  );
}

const index = readCatalogueIndex(fixtureJson("catalogue-v7.json"));
const detailFixtures = fixtureJson("entry-details-v2.json") as {
  current: Record<string, unknown>;
  removed: Record<string, unknown>;
};
const details: ReadonlyMap<string, EntryDetailV2> = new Map([
  ...Object.entries(detailFixtures.current).map(
    ([path, raw]) => [detailKey({ path }), readEntryDetail(raw)] as const,
  ),
  ...Object.entries(detailFixtures.removed).map(([snapshotId, raw]) => {
    const detail = readEntryDetail(raw);
    return [
      detailKey({ path: detail.entry.path, snapshotId }),
      detail,
    ] as const;
  }),
]);

/** Return an isolated copy of the validated catalogue index v7 fixture. */
export function indexModel(): CatalogueReadModel {
  return structuredClone(index);
}

/**
 * Return an isolated copy of the shell's working model: the index v7 fixture
 * with every validated entry detail v2 fixture held.
 */
export function catalogueModel(): ShellCatalogueReadModel {
  return shellCatalogueModel(indexModel(), structuredClone(details));
}

/** Initialize the React shell state for one fixture route. */
export function fixtureShellState({
  href = "https://example.test/view/product/browse/home/",
  initial,
  model = catalogueModel(),
}: {
  href?: string;
  initial?: ShellInitialState;
  model?: ShellCatalogueReadModel;
} = {}): ShellState {
  const catalogue = viewerCatalogue(model);
  const route = routeFromUrl(catalogue, new URL(href));
  const screenPath =
    route.view.kind === "target" ? route.view.target.entry.path : null;
  const context = viewerContext(model, { ...defaultSelection, screenPath });
  return createInitialShellState(catalogue, context, route, initial);
}
