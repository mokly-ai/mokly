/** Shell-scoped React state for standalone and application-owned roots. */

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { DetailRequest } from "../catalogue/detail_fences.js";
import type { CatalogueReadModel, EntryDetailV2 } from "../catalogue/types.js";
import type { MoklyVersionError } from "../catalogue/version_error.js";
import type { FrameAdapter } from "../client/frame_adapter.js";
import { DisplaySelection } from "../viewer/display_context.js";
import { viewerContext } from "../viewer/projection.js";
import type { ViewerSelection } from "../viewer/types.js";

import type { Catalogue } from "./catalogue.js";
import {
  ComparisonEnvironmentProvider,
  type ComparisonEnvironment,
} from "./comparison_context.js";
import type { ShellContext } from "./context.js";
import { initialSnapshot } from "./data_commit.js";
import { ShellDataBoundary } from "./data_context.js";
import type { ShellDataSource } from "./data_source.js";
import { useShellDataStore } from "./data_store.js";
import { ShellFrameEventRouter } from "./frame_event_router.js";
import { ShellFrameRegistryProvider } from "./frame_registry.js";
import { catalogueNavSections } from "./nav_model.js";
import type { ShellRoute } from "./routes.js";
import { shellStore } from "./store_actions.js";
import { useShellBrowser } from "./store_browser.js";
import { ShellStoreBoundary, type ShellStore } from "./store_context.js";
import { withFilterSelection } from "./store_filters.js";
import { type EmbeddedShellEnvironment, useShellHost } from "./store_host.js";
import { hostRoute } from "./store_host_routes.js";
import { createInitialShellState } from "./store_initial.js";
import type { ShellInitialState, ShellState } from "./store_state.js";
import { WorkspaceProvider } from "./workspace_context.js";

interface ShellStoreProviderProps {
  children: ReactNode;
  comparisonEnvironment?: ComparisonEnvironment;
  /** Route-independent values: the embedded flag and the starting theme. */
  context: Pick<ShellContext, "embedded" | "theme">;
  embeddedHost?: EmbeddedShellEnvironment;
  frameAdapter?: FrameAdapter;
  frameBaseUrl?: string | URL;
  /** The validated index the shell starts from. */
  index: CatalogueReadModel;
  /** Details already held, adopted under their fences before the first render. */
  initialDetails?: readonly (readonly [DetailRequest, EntryDetailV2])[];
  initialState?: ShellInitialState;
  interactive: boolean;
  onVersionError?: (error: MoklyVersionError) => void;
  /** The detail and live transports; absent, the shell renders the index only. */
  source?: ShellDataSource;
  /** The route the shell starts on, resolved in the starting catalogue. */
  route: (catalogue: Catalogue) => ShellRoute;
}

/** Provide one state owner to a complete shell tree. */
export function ShellStoreProvider({
  children,
  comparisonEnvironment,
  context,
  embeddedHost,
  frameAdapter,
  frameBaseUrl,
  index,
  initialDetails,
  initialState,
  interactive,
  onVersionError,
  route,
  source,
}: ShellStoreProviderProps) {
  const [initial] = useState(() => initialSnapshot(index, initialDetails));
  const [state, setState] = useState(() =>
    initialShellState(
      initial.catalogue,
      {
        ...context,
        ...viewerContext(
          initial.catalogue.publicModel!,
          defaultSelectionOf(initialState),
        ),
      },
      route(initial.catalogue),
      initialState,
      embeddedHost,
    ),
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const data = useShellDataStore({
    initial,
    interactive,
    onVersionError,
    setState,
    source,
    state,
    stateRef,
  });
  const activeCatalogue = data.snapshot.catalogue;
  const model = activeCatalogue.publicModel!;
  const activeContext = useMemo(
    () => ({
      ...viewerContext(model, state.selection),
      embedded: context.embedded === true,
      ...(context.theme ? { theme: context.theme } : {}),
    }),
    [context.embedded, context.theme, model, state.selection],
  );
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
      <ShellDataBoundary store={data}>
        <ComparisonEnvironmentProvider
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
              <WorkspaceProvider>{children}</WorkspaceProvider>
            </DisplaySelection.Provider>
          </ShellFrameRegistryProvider>
        </ComparisonEnvironmentProvider>
      </ShellDataBoundary>
    </ShellStoreBoundary>
  );
}

function defaultSelectionOf(
  initialState: ShellInitialState | undefined,
): ViewerSelection {
  return {
    screenPath: null,
    view: "all",
    viewport: "both",
    colorScheme: initialState?.colorScheme ?? "light",
    search: "",
    tags: [],
  };
}

function initialShellState(
  catalogue: Catalogue,
  context: ShellContext,
  route: ShellRoute,
  initialState: ShellInitialState | undefined,
  embeddedHost: EmbeddedShellEnvironment | undefined,
): ShellState {
  const state = createInitialShellState(
    catalogue,
    context,
    route,
    initialState,
  );
  if (!embeddedHost) return state;
  return {
    ...withFilterSelection(state, embeddedHost.selection),
    route: hostRoute(catalogue, embeddedHost.selection),
  };
}

/** Project mutable route identity into the context consumed by shell children. */
export function currentContext(
  context: ShellContext,
  state: ShellStore["state"],
) {
  const {
    activeId: _activeId,
    changesStatus: _changesStatus,
    fragment: _fragment,
    snapshotId: _snapshotId,
    ...stable
  } = context;
  const activeId =
    state.route.view.kind === "target"
      ? state.route.view.target.entry.path
      : undefined;
  return {
    ...stable,
    ...(activeId ? { activeId } : {}),
    ...(state.changesStatus ? { changesStatus: state.changesStatus } : {}),
    ...(state.route.fragment ? { fragment: state.route.fragment } : {}),
    ...(state.route.snapshot ? { snapshotId: state.route.snapshot } : {}),
  };
}
