/** Browser URL, history, and focus integration for the shell store. */

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { ViewerSelection } from "../host/types.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import type { NavSectionNode } from "./nav_tree.js";
import { useShellRoot } from "./root_context.js";
import { routeDocumentKey, routeFromUrl, routeHref } from "./routes.js";
import {
  shellBrowserActions,
  type ShellBrowserActions,
} from "./store_browser_actions.js";
import { sameShellRoute } from "./store_browser_routes.js";
import { canonicalRouteUrl, viewportUrl } from "./store_browser_urls.js";
import { withRoute } from "./store_filters.js";
import type { ShellState } from "./store_state.js";
import { viewTitle } from "./view_title.js";

interface BrowserStoreInput {
  onAppearanceRoute?:
    ((scheme: "dark" | "light" | undefined) => void) | undefined;
  catalogue: Catalogue;
  context: ShellContext;
  interactive: boolean;
  sections: readonly NavSectionNode[];
  setState: Dispatch<SetStateAction<ShellState>>;
  state: ShellState;
}

export type { ShellBrowserActions } from "./store_browser_actions.js";

/** Bind one store to standalone history and focus. */
export function useShellBrowser(input: BrowserStoreInput): ShellBrowserActions {
  const elements = useShellRoot()?.elements;
  const stateRef = useRef(input.state);
  stateRef.current = input.state;
  // The catalogue changes in place when details arrive or a publication is
  // adopted; history listeners read the latest one instead of rebinding.
  const latest = useRef(input);
  latest.current = input;
  const sequence = useRef<AbortController | undefined>(undefined);
  const installedDocumentKey = useRef<string | undefined>(undefined);
  const pendingFocus = useRef(false);

  const install = useCallback(
    (
      url: URL,
      push: boolean,
      focusMain = true,
      activated?: ReturnType<typeof routeFromUrl>,
    ) => {
      const win = window;
      const { catalogue, sections, setState } = latest.current;
      const route = activated ?? routeFromUrl(catalogue, url);
      if (push) {
        win.history.pushState(null, "", url);
      } else if (win.location.href !== url.href) {
        win.history.replaceState(win.history.state, "", url);
      }
      installedDocumentKey.current = routeDocumentKey(url);
      if (focusMain) pendingFocus.current = true;
      latest.current.onAppearanceRoute?.(route.colorScheme);
      setState((state) => withRoute(state, route, catalogue, sections));
    },
    [],
  );

  const transition = useCallback(
    async (
      requested: URL,
      push: boolean,
      activated?: ReturnType<typeof routeFromUrl>,
    ) => {
      if (!latest.current.interactive) return;
      const win = window;
      const sameDocument =
        installedDocumentKey.current === routeDocumentKey(requested);
      const requestedRoute = routeFromUrl(latest.current.catalogue, requested);
      let canonical = canonicalRouteUrl(requested, requestedRoute);
      if (requestedRoute.view.kind === "target") {
        canonical = new URL(
          routeHref(
            requestedRoute.view.target.entry.path,
            requestedRoute.fragment,
            requestedRoute,
          ),
          requested,
        );
        canonical.hash = requested.hash;
      }
      const controller = new AbortController();
      sequence.current?.abort();
      sequence.current = controller;
      if (sameDocument) {
        if (activated) {
          install(
            canonical,
            push && win.location.href !== canonical.href,
            true,
            activated,
          );
        } else if (push && win.location.href !== requested.href)
          win.location.assign(requested.href);
        if (sequence.current === controller) sequence.current = undefined;
        return;
      }
      install(canonical, push, true, activated);
      if (sequence.current === controller) sequence.current = undefined;
    },
    [install],
  );
  const navigate = useCallback(
    (href: string) => transition(new URL(href, window.location.href), true),
    [transition],
  );
  const navigateHistory = useCallback(
    (url: URL) => transition(url, false),
    [transition],
  );

  useEffect(() => {
    if (!input.interactive) return;
    const win = window;
    if (win.history.scrollRestoration) win.history.scrollRestoration = "manual";
    const catalogue = latest.current.catalogue;
    let initialUrl = new URL(win.location.href);
    let initialRoute = routeFromUrl(catalogue, initialUrl);
    const canonicalInitial = canonicalRouteUrl(initialUrl, initialRoute);
    if (canonicalInitial.href !== initialUrl.href) {
      win.history.replaceState(win.history.state, "", canonicalInitial);
      initialUrl = canonicalInitial;
      initialRoute = routeFromUrl(catalogue, initialUrl);
    }
    installedDocumentKey.current = routeDocumentKey(initialUrl);
    if (!sameShellRoute(stateRef.current.route, initialRoute))
      install(initialUrl, false, false);
    const controller = new AbortController();
    // The URL alone names the route. An entry's state, such as one that an
    // earlier viewer wrote, is never read.
    win.addEventListener(
      "popstate",
      () => void navigateHistory(new URL(win.location.href)),
      { signal: controller.signal },
    );
    return () => {
      controller.abort();
      sequence.current?.abort();
    };
  }, [input.interactive, install, navigateHistory]);

  // A viewport that the reader chooses on the shown entry, through the Frames
  // filter or the compact layout's frame picker, replaces the address's
  // `viewport` query, so the address names the shown viewport. A route
  // installation brings its own address.
  const placed = useRef<
    { installation: number; viewport: ViewerSelection["viewport"] } | undefined
  >(undefined);
  const installation = input.state.routeInstallation;
  const viewport = input.state.selection.viewport;
  useEffect(() => {
    if (!input.interactive) return;
    const before = placed.current;
    placed.current = { installation, viewport };
    if (before?.installation !== installation || before.viewport === viewport)
      return;
    const win = window;
    const url = viewportUrl(new URL(win.location.href), viewport);
    if (url.href === win.location.href) return;
    win.history.replaceState(win.history.state, "", url);
    installedDocumentKey.current = routeDocumentKey(url);
  }, [input.interactive, installation, viewport]);

  useLayoutEffect(() => {
    if (!input.interactive) return;
    document.title = viewTitle(input.catalogue, input.state.route.view);
    if (pendingFocus.current) {
      pendingFocus.current = false;
      elements?.main.current?.focus({ preventScroll: true });
    }
  }, [elements, input.catalogue, input.interactive, input.state.route]);

  return shellBrowserActions({
    elements,
    catalogue: input.catalogue,
    context: input.context,
    navigate,
    setState: input.setState,
    state: () => stateRef.current,
    transition,
  });
}
