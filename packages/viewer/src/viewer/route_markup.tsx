import type { CatalogueReadModel } from "../catalogue/types.js";
import { ShellMain } from "../shell/views.js";

import { islandMarkup } from "./markup.js";
import type { viewerCatalogue } from "./projection.js";
import { viewerContext, viewerView } from "./projection.js";
import type { ViewerSelection } from "./types.js";

export function routeMarkup(
  model: CatalogueReadModel,
  catalogue: ReturnType<typeof viewerCatalogue>,
  selection: ViewerSelection,
  baseUrl: URL,
  fragment?: string,
): string {
  const context = {
    ...viewerContext(model, selection),
    ...(fragment ? { fragment: fragment } : {}),
  };
  return islandMarkup(
    <ShellMain
      catalogue={catalogue}
      context={context}
      view={viewerView(catalogue, selection)}
    />,
    baseUrl,
    selection,
  );
}
