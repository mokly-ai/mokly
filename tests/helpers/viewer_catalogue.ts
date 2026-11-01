import fs from "node:fs";

import { detailKey } from "../../packages/viewer/dist/catalogue/detail_fences.js";
import { readEntryDetail } from "../../packages/viewer/dist/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../../packages/viewer/dist/catalogue/index_reader.js";
import type { ShellCatalogueReadModel } from "../../packages/viewer/dist/catalogue/scoped_types.js";
import { shellCatalogueModel } from "../../packages/viewer/dist/catalogue/shell_model.js";
import type {
  CatalogueReadModel,
  EntryDetailV4,
} from "../../packages/viewer/dist/catalogue/types.js";
import { createCatalogue } from "../../packages/viewer/dist/shell/catalogue.js";
import { shellContext } from "../../packages/viewer/dist/shell/projection.js";
import { routeFromUrl } from "../../packages/viewer/dist/shell/routes.js";
import { defaultSelection } from "../../packages/viewer/dist/shell/selection.js";
import { createInitialShellState } from "../../packages/viewer/dist/shell/store_initial.js";
import type {
  ShellInitialState,
  ShellState,
} from "../../packages/viewer/dist/shell/store_state.js";

function fixtureJson(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(
      new URL(`../../docs/protocol/fixtures/${name}`, import.meta.url),
      "utf8",
    ),
  );
}

const index = readCatalogueIndex(fixtureJson("catalogue-v9.json"));
const detailFixtures = fixtureJson("entry-details-v4.json") as {
  current: Record<string, unknown>;
  removed: Record<string, unknown>;
};
const details: ReadonlyMap<string, EntryDetailV4> = new Map([
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

/** Return an isolated copy of the validated catalogue index fixture. */
function indexModel(): CatalogueReadModel {
  return structuredClone(index);
}

/**
 * Return an isolated copy of the shell's working model: the index fixture
 * with every validated entry detail fixture held.
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
  const catalogue = createCatalogue(model);
  const route = routeFromUrl(catalogue, new URL(href));
  const screenPath =
    route.view.kind === "target" ? route.view.target.entry.path : null;
  const context = shellContext(model, { ...defaultSelection, screenPath });
  return createInitialShellState(catalogue, context, route, initial);
}
