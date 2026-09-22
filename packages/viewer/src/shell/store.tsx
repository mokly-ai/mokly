/** Shell-scoped React state for standalone and application-owned roots. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { FrameAdapter } from "../client/frame_adapter.js";
import { DisplaySelection } from "../viewer/display_context.js";
import type { ViewerSelection } from "../viewer/types.js";

import { ViewerLiveBoundary } from "./capability_context.js";
import { useViewerCapabilityStore } from "./capability_store.js";
import type { Catalogue } from "./catalogue.js";
import {
  ComparisonEnvironmentProvider,
  type ComparisonEnvironment,
} from "./comparison_context.js";
import type { ShellContext } from "./context.js";
import { ShellFrameEventRouter } from "./frame_event_router.js";
import { ShellFrameRegistryProvider } from "./frame_registry.js";
import { catalogueNavSections } from "./nav_model.js";
import { routeScreenId, type ShellRoute } from "./routes.js";
import { shellRecoverySnapshot, shellStore } from "./store_actions.js";
import { useShellBrowser } from "./store_browser.js";
import { ShellStoreBoundary, type ShellStore } from "./store_context.js";
import { withFilterSelection } from "./store_filters.js";
import { type EmbeddedShellEnvironment, useShellHost } from "./store_host.js";
import { hostRoute } from "./store_host_routes.js";
import { createInitialShellState } from "./store_initial.js";
import type {
  ShellInitialState,
  ShellRecoverySnapshot,
  ShellState,
} from "./store_state.js";
import type { ShellView } from "./views.js";

interface ShellStoreProviderProps {
  catalogue: Catalogue;
  children: ReactNode;
  comparisonEnvironment?: ComparisonEnvironment;
  context: ShellContext;
  embeddedHost?: EmbeddedShellEnvironment;
  frameAdapter?: FrameAdapter;
  frameBaseUrl?: string | URL;
  initialState?: ShellInitialState;
  interactive: boolean;
  recovery?: ShellRecoverySnapshot;
  view: ShellView;
}

/** Provide one state owner to a complete shell tree. */
export function ShellStoreProvider({
  catalogue,
  children,
  comparisonEnvironment,
  context,
  embeddedHost,
  frameAdapter,
  frameBaseUrl,
  initialState,
  interactive,
  recovery,
  view,
}: ShellStoreProviderProps) {
  const [state, setState] = useState(() =>
    initialShellState(catalogue, context, view, initialState, embeddedHost),
  );
  const stateRef = useRef(state);
  const recoveryApplied = useRef(false);
  stateRef.current = state;
  const capabilityStore = useViewerCapabilityStore({
    captureRecovery: () =>
      shellRecoverySnapshot(
        stateRef.current,
        interactive && embeddedHost === undefined,
      ),
    catalogue,
    context,
    interactive,
    setState,
    state,
    stateRef,
  });
  const activeCatalogue = capabilityStore.catalogue;
  const activeContext = capabilityStore.context;
  const sections = useMemo(
    () => catalogueNavSections(activeCatalogue),
    [activeCatalogue],
  );
  const browser = useShellBrowser({
    catalogue: activeCatalogue,
    context: activeContext,
    interactive: interactive && !embeddedHost,
    sections,
    setState,
    state,
  });
  const host = useShellHost({
    catalogue: activeCatalogue,
    context: activeContext,
    ...(embeddedHost ? { environment: embeddedHost } : {}),
    interactive,
    sections,
    setState,
    state,
  });
  const runtimeContext = useMemo(
    () => currentContext(activeContext, state),
    [activeContext, state.changesStatus, state.route],
  );

  useEffect(() => {
    if (embeddedHost || !interactive || !recovery || recoveryApplied.current)
      return;
    recoveryApplied.current = true;
    setState((current) => {
      const restored = createInitialShellState(catalogue, context, view, {
        ...initialState,
        recovery,
      });
      const selection = selectionForRoute(restored.selection, current.route);
      return { ...restored, route: current.route, selection };
    });
  }, [
    catalogue,
    context,
    embeddedHost,
    initialState,
    interactive,
    recovery,
    view,
  ]);

  const store = shellStore({
    catalogue: activeCatalogue,
    context: runtimeContext,
    embedded: embeddedHost !== undefined,
    interactive,
    navigation: embeddedHost ? host : browser,
    propose: host.select,
    sections,
    setState,
    state,
    stateRef,
  });
  return (
    <ShellStoreBoundary value={store}>
      <ViewerLiveBoundary value={capabilityStore.liveState}>
        <ComparisonEnvironmentProvider
          context={runtimeContext}
          interactive={interactive}
          {...(comparisonEnvironment
            ? { environment: comparisonEnvironment }
            : {})}
        >
          <ShellFrameRegistryProvider
            {...(frameAdapter ? { adapter: frameAdapter } : {})}
            {...(frameBaseUrl ? { baseUrl: frameBaseUrl } : {})}
          >
            <DisplaySelection.Provider value={state.selection}>
              <ShellFrameEventRouter />
              {children}
            </DisplaySelection.Provider>
          </ShellFrameRegistryProvider>
        </ComparisonEnvironmentProvider>
      </ViewerLiveBoundary>
    </ShellStoreBoundary>
  );
}

function initialShellState(
  catalogue: Catalogue,
  context: ShellContext,
  view: ShellView,
  initialState: ShellInitialState | undefined,
  embeddedHost: EmbeddedShellEnvironment | undefined,
): ShellState {
  const state = createInitialShellState(catalogue, context, view, initialState);
  if (!embeddedHost) return state;
  return {
    ...withFilterSelection(state, embeddedHost.selection),
    route: hostRoute(catalogue, embeddedHost.selection),
  };
}

/** Synchronize recovered preferences with the route that won initialization. */
export function selectionForRoute(
  selection: ViewerSelection,
  route: ShellRoute,
): ViewerSelection {
  const next = { ...selection, screenId: routeScreenId(route) };
  if (route.snapshot) next.snapshotId = route.snapshot;
  else delete next.snapshotId;
  if (route.variant) next.variantId = route.variant;
  else delete next.variantId;
  return next;
}

/** Project mutable route identity into the context consumed by shell children. */
export function currentContext(
  context: ShellContext,
  state: ShellStore["state"],
) {
  const {
    activeRoute: _activeRoute,
    changesStatus: _changesStatus,
    fragment: _fragment,
    snapshotId: _snapshotId,
    ...stable
  } = context;
  const activeRoute =
    state.route.view.kind === "target"
      ? state.route.view.target.entry.route
      : undefined;
  return {
    ...stable,
    ...(activeRoute ? { activeRoute } : {}),
    ...(state.changesStatus ? { changesStatus: state.changesStatus } : {}),
    ...(state.route.fragment ? { fragment: state.route.fragment } : {}),
    ...(state.route.snapshot ? { snapshotId: state.route.snapshot } : {}),
  };
}
