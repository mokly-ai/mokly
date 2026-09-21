import fs from "node:fs";

import { readCatalogue } from "../../packages/viewer/dist/catalogue/reader.js";
import type { CatalogueReadModel } from "../../packages/viewer/dist/catalogue/types.js";
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

const fixture = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

/** Return an isolated copy of the validated public catalogue fixture. */
export function catalogueModel(): CatalogueReadModel {
  return structuredClone(fixture);
}

/** Initialize the React shell state for one fixture route. */
export function fixtureShellState({
  href = "https://example.test/view/screens/home.html",
  initial,
  model = catalogueModel(),
}: {
  href?: string;
  initial?: ShellInitialState;
  model?: CatalogueReadModel;
} = {}): ShellState {
  const catalogue = viewerCatalogue(model);
  const route = routeFromUrl(catalogue, new URL(href));
  const screenId =
    route.view.kind === "target" ? route.view.target.entry.id : null;
  const context = viewerContext(model, { ...defaultSelection, screenId });
  return createInitialShellState(catalogue, context, route.view, initial);
}
