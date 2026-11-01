/** Shared React-owned shell layout for embedded viewer roots. */

import { useCallback, useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { EmbeddedLayout } from "@mokly/ui/embedded-layout";

import type {
  ViewerEvents,
  ViewerMarker,
  ViewerSlots,
  ViewerTheme,
} from "../host/types.js";

import { ShellFrameMarkerLayer } from "./frame_marker_layer.js";
import { useShellFragment, useShellIdentifier } from "./identifier_context.js";
import { CatalogueNav } from "./nav.js";
import { useNavigationBounds } from "./nav_resize.js";
import { useShellRoot } from "./root_context.js";
import { useShellStore } from "./store_context.js";
import { useShellBindings } from "./store_interactions.js";
import { normalizeTheme } from "./theme.js";
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
  const shellRoot = useShellRoot();
  const root = shellRoot?.elements.root ?? rootRef ?? localRoot;
  const attachRoot = shellRoot?.ref;
  const ref = useCallback(
    (element: HTMLDivElement | null) => {
      if (attachRoot) attachRoot(element);
      else root.current = element;
      if (rootRef) rootRef.current = element;
    },
    [attachRoot, root, rootRef],
  );
  const mainFragment = useShellFragment("mb-main");
  const statusId = useShellIdentifier("mb-status");
  useNavigationBounds(root);
  useShellBindings(root, store);
  return (
    <EmbeddedLayout
      announcement={store.state.announcement}
      colorScheme={store.state.selection.colorScheme}
      drawerOpen={store.state.drawerOpen}
      frameExpanded={Boolean(store.state.expandedFrame)}
      resizing={shellRoot?.resizing}
      slotRef={shellRoot?.elements.slots.ref}
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
      ref={ref}
      slots={slots}
      statusId={statusId}
      theme={normalizeTheme(theme)}
      topBar={<TopBar catalogue={store.catalogue} />}
    />
  );
}
