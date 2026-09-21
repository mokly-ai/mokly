import { memo } from "react";

import type { Catalogue } from "../shell/catalogue.js";
import type { ShellContext } from "../shell/context.js";
import { CatalogueNav } from "../shell/nav.js";
import { TopBar } from "../shell/top_bar.js";
import { ShellMain } from "../shell/views.js";
import type { ShellView } from "../shell/views.js";

import { MarkerLayer } from "./marker_layer.js";
import type { MarkerStore } from "./marker_store.js";
import { islandMarkup } from "./markup.js";
import { themeAttributes } from "./theme.js";
import type {
  ViewerMarker,
  ViewerSelection,
  ViewerSlots,
  ViewerTheme,
} from "./types.js";

export interface LayoutProps {
  catalogue: Catalogue;
  context: ShellContext;
  view: ShellView;
  selection: ViewerSelection;
  baseUrl: URL;
  markerStore?: MarkerStore;
  markers?: readonly ViewerMarker[];
  slots?: ViewerSlots;
  theme?: ViewerTheme;
}
// The runtime owns these islands after mount; React only updates the slots.
const Island = memo(
  function Island({ markup }: { markup: string }) {
    return (
      <div
        className="mokly-island"
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    );
  },
  () => true,
);
export function ViewerLayout({
  catalogue,
  context,
  view,
  selection,
  baseUrl,
  markerStore,
  markers,
  slots,
  theme,
}: LayoutProps) {
  return (
    <div
      className="mbk mokly-viewer"
      data-drawer="closed"
      tabIndex={-1}
      data-mokly-shell=""
      data-mokly-color-scheme={selection.colorScheme}
      {...themeAttributes(theme)}
    >
      <a className="mbk-skip-link" href="#mb-main">
        Skip to content
      </a>
      <div className="mokly-top-host">
        <div data-mokly-slot="topBarStart">{slots?.topBarStart}</div>
        <Island
          markup={islandMarkup(
            <TopBar catalogue={catalogue} />,
            baseUrl,
            selection,
          )}
        />
        <div data-mokly-slot="topBarEnd">{slots?.topBarEnd}</div>
      </div>
      <div className="mbk-body">
        <div className="mokly-rail-host">
          <div data-mokly-slot="railStart">{slots?.railStart}</div>
          <Island
            markup={islandMarkup(
              <CatalogueNav catalogue={catalogue} context={context} />,
              baseUrl,
              selection,
            )}
          />
          <div data-mokly-slot="railEnd">{slots?.railEnd}</div>
        </div>
        <div className="mokly-stage-host">
          <Island
            markup={islandMarkup(
              <ShellMain catalogue={catalogue} context={context} view={view} />,
              baseUrl,
              selection,
            )}
          />
          <div
            data-mokly-slot="emptyState"
            hidden={view.kind !== "home" || slots?.emptyState === undefined}
          >
            {slots?.emptyState}
          </div>
          <div
            data-mokly-slot="stageOverlay"
            style={{
              pointerEvents: slots?.stageOverlay?.pointerEvents ?? "none",
            }}
          >
            {slots?.stageOverlay?.content}
          </div>
        </div>
        <div
          data-mokly-slot="sidePanel"
          style={{ width: slots?.sidePanel?.width }}
        >
          {slots?.sidePanel?.content}
        </div>
      </div>
      {markerStore ? (
        <MarkerLayer markers={markers ?? []} store={markerStore} />
      ) : (
        <div data-mokly-marker-layer="" data-mokly-slot="markers" />
      )}
      <div
        data-mokly-label-layer=""
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      />
      <p
        aria-atomic="true"
        aria-live="polite"
        className="mbk-route-status"
        id="mb-status"
        role="status"
      />
    </div>
  );
}
