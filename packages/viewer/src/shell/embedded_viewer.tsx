/** Shared React-owned shell layout for embedded viewer roots. */

import { useRef } from "react";
import type { ReactNode, RefObject } from "react";

import type {
  ViewerEvents,
  ViewerMarker,
  ViewerSlots,
} from "../viewer/types.js";

import { EmbeddedStageOverlay } from "./embedded_stage_overlay.js";
import { ShellFrameMarkerLayer } from "./frame_marker_layer.js";
import { useShellFragment, useShellIdentifier } from "./identifier_context.js";
import { CatalogueNav } from "./nav.js";
import { useNavigationBounds } from "./nav_resize.js";
import { useShellStore } from "./store_context.js";
import { TopBar } from "./top_bar.js";
import { ShellMain } from "./views.js";

export interface EmbeddedViewerShellProps {
  inspection?: ReactNode;
  markers?: readonly ViewerMarker[];
  onError?: ViewerEvents["onError"];
  onMarkerChange?: ViewerEvents["onMarkerChange"];
  rootRef?: RefObject<HTMLDivElement | null>;
  slots?: ViewerSlots;
}

/** Render the actual shell components while preserving ordinary host slots. */
export function EmbeddedViewerShell({
  inspection,
  markers = [],
  onError,
  onMarkerChange,
  rootRef,
  slots,
}: EmbeddedViewerShellProps) {
  const store = useShellStore();
  const localRoot = useRef<HTMLDivElement>(null);
  const root = rootRef ?? localRoot;
  const mainFragment = useShellFragment("mb-main");
  const statusId = useShellIdentifier("mb-status");
  useNavigationBounds(root);
  return (
    <div
      className="mbk mokly-viewer"
      data-drawer={store.state.drawerOpen ? "open" : "closed"}
      data-mokly-color-scheme={store.state.selection.colorScheme}
      data-mokly-shell=""
      onClick={store.onShellClick}
      onKeyDown={store.onShellKeyDown}
      ref={root}
      tabIndex={-1}
    >
      <a className="mbk-skip-link" href={mainFragment}>
        Skip to content
      </a>
      <div className="mokly-top-host">
        <div data-mokly-slot="topBarStart">{slots?.topBarStart}</div>
        <TopBar catalogue={store.catalogue} />
        <div data-mokly-slot="topBarEnd">{slots?.topBarEnd}</div>
      </div>
      <div className="mbk-body">
        <div className="mokly-rail-host">
          <div data-mokly-slot="railStart">{slots?.railStart}</div>
          <CatalogueNav catalogue={store.catalogue} context={store.context} />
          <div data-mokly-slot="railEnd">{slots?.railEnd}</div>
        </div>
        <div className="mokly-stage-host">
          <ShellMain
            catalogue={store.catalogue}
            context={store.context}
            view={store.state.route.view}
          />
          <div
            data-mokly-slot="emptyState"
            hidden={
              store.state.route.view.kind !== "home" ||
              slots?.emptyState === undefined
            }
          >
            {slots?.emptyState}
          </div>
          <EmbeddedStageOverlay
            {...(slots?.stageOverlay ? { value: slots.stageOverlay } : {})}
          />
        </div>
        <div
          data-mokly-slot="sidePanel"
          style={{ width: slots?.sidePanel?.width }}
        >
          {slots?.sidePanel?.content}
        </div>
      </div>
      <ShellFrameMarkerLayer
        markers={markers}
        {...(onError ? { onError } : {})}
        {...(onMarkerChange ? { onMarkerChange } : {})}
      />
      {inspection ?? <div data-mokly-label-layer="" />}
      <p
        aria-atomic="true"
        aria-live="polite"
        className="mbk-route-status"
        id={statusId}
        role="status"
      >
        {store.state.announcement}
      </p>
    </div>
  );
}
