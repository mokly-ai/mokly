/** Shared React-owned shell layout for embedded viewer roots. */

import { useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { EmbeddedLayout } from "@mokly/ui/embedded-layout";

import { normalizeTheme } from "../viewer/theme.js";
import type {
  ViewerEvents,
  ViewerMarker,
  ViewerSlots,
  ViewerTheme,
} from "../viewer/types.js";

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
  theme?: ViewerTheme;
}

/** Render the actual shell components while preserving ordinary host slots. */
export function EmbeddedViewerShell({
  inspection,
  markers = [],
  onError,
  onMarkerChange,
  rootRef,
  slots,
  theme,
}: EmbeddedViewerShellProps) {
  const store = useShellStore();
  const localRoot = useRef<HTMLDivElement>(null);
  const root = rootRef ?? localRoot;
  const mainFragment = useShellFragment("mb-main");
  const statusId = useShellIdentifier("mb-status");
  useNavigationBounds(root);
  return (
    <EmbeddedLayout
      announcement={store.state.announcement}
      colorScheme={store.state.selection.colorScheme}
      drawerOpen={store.state.drawerOpen}
      emptyStateShown={
        store.state.route.view.kind === "home" &&
        slots?.emptyState !== undefined
      }
      labelLayer={inspection}
      main={
        <ShellMain
          catalogue={store.catalogue}
          context={store.context}
          view={store.state.route.view}
        />
      }
      mainHref={mainFragment}
      markerLayer={
        <ShellFrameMarkerLayer
          markers={markers}
          {...(onError ? { onError } : {})}
          {...(onMarkerChange ? { onMarkerChange } : {})}
        />
      }
      navigation={
        <CatalogueNav catalogue={store.catalogue} context={store.context} />
      }
      onClick={store.onShellClick}
      onKeyDown={store.onShellKeyDown}
      ref={root}
      slots={slots}
      statusId={statusId}
      theme={normalizeTheme(theme)}
      topBar={<TopBar catalogue={store.catalogue} />}
    />
  );
}
