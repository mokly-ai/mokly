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
import type { NavSectionNode } from "./nav_tree.js";
import { routeFromUrl, type ShellRoute } from "./routes.js";
import type { ShellBrowserActions } from "./store_browser.js";
import { withFilterSelection } from "./store_filters.js";
import {
  announceNavigation,
  hostClick,
  hostKeyDown,
  hostRoute,
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
        current.selection.screenId !== selection.screenId ||
        current.selection.variantId !== selection.variantId;
      const frameChanged =
        routeChanged ||
        current.selection.viewport !== selection.viewport ||
        current.selection.colorScheme !== selection.colorScheme;
      const fragment =
        pending?.fragment ??
        (current.selection.screenId === selection.screenId
          ? current.route.fragment
          : undefined);
      let next = withFilterSelection(current, selection);
      if (routeChanged || fragment !== current.route.fragment) {
        const route = hostRoute(input.catalogue, selection, fragment);
        next = withHostRoute(next, route, input.sections);
      }
      if (rawQuery !== undefined) next = { ...next, query: rawQuery };
      stateRef.current = next;
      input.setState(next);
      if (frameChanged || fragment !== current.route.fragment)
        environment.onNavigation();
      if (routeChanged || fragment !== current.route.fragment) {
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
        if (rawQuery !== undefined) {
          pendingQuery.current = { raw: rawQuery, selection: next };
          input.setState((state) => ({ ...state, query: rawQuery }));
        }
        return;
      }
      const routeChanged =
        current.screenId !== next.screenId ||
        current.variantId !== next.variantId;
      const navigation = routeChanged
        ? {
            selection: next,
            ...(current.screenId === next.screenId &&
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
      const screenId =
        route.view.kind === "target" ? route.view.target.entry.id : null;
      const next = mergeSelection(
        environment.model,
        stateRef.current.selection,
        {
          screenId,
          variantId: route.variant,
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
      requestRoute(
        routeFromUrl(input.catalogue, new URL(href, environment.baseUrl)),
        navigation,
      );
    },
    onShellClick(event) {
      hostClick(
        event,
        input.catalogue,
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
    selectVariant(value) {
      const environment = environmentRef.current;
      if (!environment) return;
      const route = hostRoute(
        input.catalogue,
        mergeSelection(environment.model, stateRef.current.selection, {
          variantId: value,
        }),
        stateRef.current.route.fragment,
      );
      requestRoute(route);
    },
  };
}
