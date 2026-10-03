/** Embedded host selection and navigation integration for the shared shell store. */

import { useCallback, useLayoutEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { CatalogueReadModel } from "../catalogue/types.js";
import type { FrameNavigation } from "../client/frame_adapter.js";
import {
  mergeSelection,
  sameSelection,
  selectionQuery,
} from "../viewer/selection.js";
import type { ViewerEvents, ViewerSelection } from "../viewer/types.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import type { NavSectionNode } from "./nav_tree.js";
import { routeFromUrl, type ShellRoute } from "./routes.js";
import type { ShellBrowserActions } from "./store_browser.js";
import { withFilterSelection } from "./store_filters.js";
import {
  announceNavigation,
  frameMissState,
  hostClick,
  hostKeyDown,
  hostRoute,
  hostSelectionRouteChanged,
  type PendingNavigation,
  withHostRoute,
} from "./store_host_routes.js";
import type { ShellState } from "./store_state.js";

/** Host behavior needed by an application-owned shell root. */
export interface EmbeddedShellEnvironment {
  baseUrl: URL;
  controlled: boolean;
  events(): ViewerEvents;
  model: CatalogueReadModel;
  onNavigation(): void;
  open(url: string, target: string, features: string): unknown;
  selection: ViewerSelection;
}

export interface ShellHostActions extends ShellBrowserActions {
  select(selection: Partial<ViewerSelection>, rawQuery?: string): void;
}

interface HostStoreInput {
  catalogue: Catalogue;
  context: ShellContext;
  environment?: EmbeddedShellEnvironment;
  interactive: boolean;
  sections: readonly NavSectionNode[];
  setState: Dispatch<SetStateAction<ShellState>>;
  state: ShellState;
}

interface PendingQuery {
  raw: string;
  selection: ViewerSelection;
}

/** Bind shell actions to controlled or uncontrolled public viewer props. */
export function useShellHost(input: HostStoreInput): ShellHostActions {
  const stateRef = useRef(input.state);
  const environmentRef = useRef(input.environment);
  const pendingNavigation = useRef<PendingNavigation | undefined>(undefined);
  const pendingQuery = useRef<PendingQuery | undefined>(undefined);
  stateRef.current = input.state;
  environmentRef.current = input.environment;

  const commit = useCallback(
    (
      selection: ViewerSelection,
      rawQuery?: string,
      pending?: PendingNavigation,
    ) => {
      const environment = environmentRef.current;
      if (!environment) return;
      const current = stateRef.current;
      const routeChanged =
        current.selection.screenPath !== selection.screenPath ||
        current.selection.snapshotId !== selection.snapshotId;
      const frameChanged =
        routeChanged ||
        current.selection.viewport !== selection.viewport ||
        current.selection.colorScheme !== selection.colorScheme;
      const routeAligned = !hostSelectionRouteChanged(
        input.catalogue,
        current,
        selection,
        current.route.fragment,
      );
      const fragment =
        pending?.fragment ??
        (current.selection.screenPath === selection.screenPath &&
        current.selection.snapshotId === selection.snapshotId &&
        routeAligned
          ? current.route.fragment
          : undefined);
      const displayChanged = hostSelectionRouteChanged(
        input.catalogue,
        current,
        selection,
        fragment,
      );
      let next = withFilterSelection(current, selection);
      if (displayChanged) {
        const route = hostRoute(input.catalogue, selection, fragment);
        next = withHostRoute(next, route, input.sections);
      }
      if (rawQuery !== undefined) next = { ...next, query: rawQuery };
      stateRef.current = next;
      input.setState(next);
      if (frameChanged || displayChanged) environment.onNavigation();
      if (displayChanged) {
        announceNavigation(environment, selection, fragment, pending);
      }
    },
    [input.catalogue, input.sections, input.setState],
  );

  const select = useCallback(
    (partial: Partial<ViewerSelection>, rawQuery?: string) => {
      const environment = environmentRef.current;
      if (!environment) return;
      const current = stateRef.current.selection;
      const next = mergeSelection(environment.model, current, partial);
      if (sameSelection(current, next)) {
        if (
          !environment.controlled &&
          hostSelectionRouteChanged(input.catalogue, stateRef.current, next)
        ) {
          commit(next, rawQuery);
          return;
        }
        if (rawQuery !== undefined) {
          pendingQuery.current = { raw: rawQuery, selection: next };
          input.setState((state) => ({ ...state, query: rawQuery }));
        }
        return;
      }
      const routeChanged =
        current.screenPath !== next.screenPath ||
        current.snapshotId !== next.snapshotId;
      const navigation = routeChanged
        ? {
            selection: next,
            ...(current.screenPath === next.screenPath &&
            current.snapshotId === next.snapshotId &&
            stateRef.current.route.fragment
              ? { fragment: stateRef.current.route.fragment }
              : {}),
          }
        : undefined;
      pendingNavigation.current = navigation;
      if (rawQuery !== undefined)
        pendingQuery.current = { raw: rawQuery, selection: next };
      if (!environment.controlled) commit(next, rawQuery, navigation);
      environment.events().onSelectionChange?.(next);
    },
    [commit, input.setState],
  );

  const requestRoute = useCallback(
    (route: ShellRoute, navigation?: FrameNavigation) => {
      const environment = environmentRef.current;
      if (!environment) return;
      const screenPath =
        route.view.kind === "target" ? route.view.target.entry.path : null;
      const next = mergeSelection(
        environment.model,
        stateRef.current.selection,
        {
          screenPath,
          snapshotId: route.snapshot,
          ...(route.viewport ? { viewport: route.viewport } : {}),
          ...(route.colorScheme ? { colorScheme: route.colorScheme } : {}),
        },
      );
      const pending: PendingNavigation = {
        selection: next,
        ...(route.fragment ? { fragment: route.fragment } : {}),
        ...(navigation ? { navigation } : {}),
      };
      pendingNavigation.current = pending;
      if (sameSelection(stateRef.current.selection, next)) {
        commit(next, undefined, pending);
        return;
      }
      if (!environment.controlled) commit(next, undefined, pending);
      environment.events().onSelectionChange?.(next);
    },
    [commit],
  );

  useLayoutEffect(() => {
    const environment = input.environment;
    if (!environment?.controlled || !input.interactive) return;
    const current = stateRef.current.selection;
    if (sameSelection(current, environment.selection)) {
      const rejected = pendingQuery.current;
      if (rejected && !sameSelection(rejected.selection, current)) {
        pendingNavigation.current = undefined;
        pendingQuery.current = undefined;
        input.setState((state) => ({
          ...state,
          query: selectionQuery(current),
        }));
      }
      return;
    }
    const navigation = pendingNavigation.current;
    const acceptedNavigation =
      navigation && sameSelection(navigation.selection, environment.selection)
        ? navigation
        : undefined;
    const query = pendingQuery.current;
    const acceptedRaw =
      query && sameSelection(query.selection, environment.selection)
        ? query.raw
        : undefined;
    pendingNavigation.current = undefined;
    pendingQuery.current = undefined;
    commit(environment.selection, acceptedRaw, acceptedNavigation);
  }, [commit, input.environment, input.interactive]);

  return {
    navigateFrame(href, navigation) {
      const environment = environmentRef.current;
      if (!environment) return;
      const route = routeFromUrl(
        input.catalogue,
        new URL(href, environment.baseUrl),
      );
      if (route.view.kind === "missing") {
        const current = stateRef.current;
        const next = frameMissState(
          current,
          route,
          input.sections,
          environment.controlled,
        );
        environment.events().onError?.({
          code: "frame",
          message: "The requested catalogue selection is unavailable.",
        });
        if (next === current) return;
        stateRef.current = next;
        input.setState(next);
        environment.onNavigation();
        return;
      }
      requestRoute(route, navigation);
    },
    onShellClick(event) {
      hostClick(
        event,
        input.catalogue,
        input.context,
        environmentRef.current,
        requestRoute,
        input.setState,
        stateRef.current,
      );
    },
    onShellKeyDown(event) {
      hostKeyDown(event, input.setState, stateRef.current);
    },
    openFrame(href, target) {
      const environment = environmentRef.current;
      if (!environment) return;
      environment.open(
        new URL(href, environment.baseUrl).href,
        target,
        "noopener",
      );
    },
    select,
  };
}
