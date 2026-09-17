import { renderToStaticMarkup } from "react-dom/server";

import type { CatalogueReadModel } from "../catalogue/types.js";
import type { Catalogue } from "../shell/catalogue.js";
import type { ShellContext } from "../shell/context.js";
import { renderShellPage } from "../shell/document.js";
import type { ShellView } from "../shell/views.js";

import { ViewerLayout } from "./layout.js";
import { viewerCatalogue, viewerContext, viewerView } from "./projection.js";
import { defaultSelection, normalizeSelection } from "./selection.js";
import { readObjectSource } from "./source.js";
import type { ViewerSelection, ViewerSlots } from "./types.js";

export interface ServerViewerProps {
  catalogue: CatalogueReadModel;
  baseUrl: string | URL;
  selection?: ViewerSelection;
  defaultSelection?: Partial<ViewerSelection>;
  slots?: ViewerSlots;
}
export interface ViewerServerContext {
  catalogue: Catalogue;
  context: ShellContext;
  view: ShellView;
}
/** Synchronous object-only SSR; first-party hosts retain their full document envelope. */
export function renderViewer(
  props: ServerViewerProps,
  host?: ViewerServerContext,
): string {
  if (host) return renderShellPage(host.catalogue, host.view, host.context);
  const loaded = readObjectSource(props.catalogue, props.baseUrl);
  if (!loaded) throw new Error("Server rendering requires a catalogue object.");
  if (props.selection && props.defaultSelection)
    throw new Error("Choose one initial selection.");
  const selection = normalizeSelection(
    props.selection ?? { ...defaultSelection, ...props.defaultSelection },
  );
  const catalogue = viewerCatalogue(loaded.catalogue);
  return renderToStaticMarkup(
    <div style={{ display: "contents" }}>
      <ViewerLayout
        catalogue={catalogue}
        context={viewerContext(loaded.catalogue, selection)}
        view={viewerView(catalogue, selection)}
        selection={selection}
        baseUrl={loaded.url}
        {...(props.slots ? { slots: props.slots } : {})}
      />
    </div>,
  );
}
