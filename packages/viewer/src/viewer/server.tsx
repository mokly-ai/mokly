/** Server rendering for public viewer and first-party shell hosts. */

import { renderToString } from "react-dom/server";

import type { CatalogueReadModel } from "../catalogue/types.js";
import type { Catalogue } from "../shell/catalogue.js";
import type { ShellContext } from "../shell/context.js";
import { renderShellPage } from "../shell/document.js";
import { EmbeddedViewerShell } from "../shell/embedded_viewer.js";
import { ShellIdentifierProvider } from "../shell/identifier_context.js";
import { ShellStoreProvider } from "../shell/store.js";
import type { ShellView } from "../shell/views.js";

import {
  viewerComparisonEnvironment,
  viewerShellEnvironment,
} from "./environment.js";
import { viewerIdentifierPrefix } from "./identifiers.js";
import { viewerCatalogue, viewerContext, viewerView } from "./projection.js";
import { defaultSelection, normalizeSelection } from "./selection.js";
import { readObjectSource } from "./source.js";
import type { ViewerSelection, ViewerSlots } from "./types.js";

export interface ServerViewerProps {
  /** Stable identifier unique among viewer roots in the host document. */
  viewerId: string;
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

/** Synchronous object-only SSR; first-party hosts retain their document envelope. */
export function renderViewer(
  props: ServerViewerProps,
  host?: ViewerServerContext,
): string {
  if (host) return renderShellPage(host.catalogue, host.view, host.context);
  const identifierPrefix = viewerIdentifierPrefix(props.viewerId);
  const loaded = readObjectSource(props.catalogue, props.baseUrl);
  if (!loaded) throw new Error("Server rendering requires a catalogue object.");
  if (props.selection && props.defaultSelection)
    throw new Error("Choose one initial selection.");
  const selection = normalizeSelection(
    loaded.catalogue,
    props.selection ?? { ...defaultSelection, ...props.defaultSelection },
  );
  const catalogue = viewerCatalogue(loaded.catalogue);
  const environment = viewerShellEnvironment(
    loaded,
    selection,
    props.selection !== undefined,
    () => ({}),
    () => {},
  );
  return renderToString(
    <ShellIdentifierProvider prefix={identifierPrefix}>
      <ShellStoreProvider
        catalogue={catalogue}
        comparisonEnvironment={viewerComparisonEnvironment(loaded)}
        context={viewerContext(loaded.catalogue, selection)}
        embeddedHost={environment}
        frameBaseUrl={loaded.url}
        interactive={false}
        view={viewerView(catalogue, selection)}
      >
        <EmbeddedViewerShell {...(props.slots ? { slots: props.slots } : {})} />
      </ShellStoreProvider>
    </ShellIdentifierProvider>,
  );
}
