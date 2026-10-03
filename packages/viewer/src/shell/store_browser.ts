/** Browser URL, history, focus, and scroll integration for the shell store. */

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import { standaloneAppearanceHost } from "../standalone/appearance_host.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { currentDeploymentMatches } from "./delivery.js";
import type { NavSectionNode } from "./nav_tree.js";
import { routeDocumentKey, routeFromUrl, routeHref } from "./routes.js";
import {
  shellBrowserActions,
  type ShellBrowserActions,
} from "./store_browser_actions.js";
import { sameShellRoute } from "./store_browser_routes.js";
import { canonicalRouteUrl } from "./store_browser_urls.js";
import { withRoute } from "./store_filters.js";
import {
  captureScrolls,
  historyScrolls,
  persistScroll,
  restoreScrolls,
} from "./store_scroll.js";
import type { ShellState } from "./store_state.js";
import { viewTitle } from "./views.js";

interface BrowserStoreInput {
  catalogue: Catalogue;
  context: ShellContext;
  interactive: boolean;
  sections: readonly NavSectionNode[];
  setState: Dispatch<SetStateAction<ShellState>>;
  state: ShellState;
}

export type { ShellBrowserActions } from "./store_browser_actions.js";

/** Bind one store to standalone history without reading globals during SSR. */
export function useShellBrowser(input: BrowserStoreInput): ShellBrowserActions {
  const stateRef = useRef(input.state);
  stateRef.current = input.state;
  const sequence = useRef<AbortController | undefined>(undefined);
  const installedDocumentKey = useRef<string | undefined>(undefined);
  const pendingScroll = useRef<Readonly<Record<string, number>> | undefined>(
    undefined,
  );
  const pendingFocus = useRef(false);

  const install = useCallback(
    (
      url: URL,
      push: boolean,
      scrolls: Readonly<Record<string, number>> = {},
      restore = true,
      activated?: ReturnType<typeof routeFromUrl>,
    ) => {
      const win = window;
      const route = activated ?? routeFromUrl(input.catalogue, url);
      if (push) {
        persistScroll(win, captureScrolls(document));
        win.history.pushState({ scrolls: {} }, "", url);
      } else if (win.location.href !== url.href) {
        win.history.replaceState(win.history.state, "", url);
      }
      installedDocumentKey.current = routeDocumentKey(url);
      if (restore) {
        pendingScroll.current = scrolls;
        pendingFocus.current = true;
      }
      standaloneAppearanceHost(win)?.applyRoute(route.colorScheme);
      input.setState((state) =>
        withRoute(state, route, input.catalogue, input.sections),
      );
    },
    [input.catalogue, input.context.delivery, input.sections, input.setState],
  );

  const transition = useCallback(
    async (
      requested: URL,
      push: boolean,
      scrolls: Readonly<Record<string, number>> = {},
      activated?: ReturnType<typeof routeFromUrl>,
    ) => {
      if (!input.interactive) return;
      const win = window;
      const sameDocument =
        installedDocumentKey.current === routeDocumentKey(requested);
      const requestedRoute = routeFromUrl(input.catalogue, requested);
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
      if (input.context.delivery && input.catalogue.publicModel) {
        const matches = await currentDeploymentMatches(
          win,
          input.catalogue.publicModel,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (!matches) {
          win.location.assign((sameDocument ? requested : canonical).href);
          return;
        }
      }
      if (controller.signal.aborted) return;
      if (sameDocument) {
        if (activated) {
          install(
            canonical,
            push && win.location.href !== canonical.href,
            scrolls,
            true,
            activated,
          );
        } else if (push && win.location.href !== requested.href)
          win.location.assign(requested.href);
        else if (!push) restoreScrolls(document, scrolls);
        if (sequence.current === controller) sequence.current = undefined;
        return;
      }
      install(canonical, push, scrolls, true, activated);
      if (sequence.current === controller) sequence.current = undefined;
    },
    [input.catalogue, input.context.delivery, input.interactive, install],
  );
  const navigate = useCallback(
    (href: string) => transition(new URL(href, window.location.href), true),
    [transition],
  );
  const navigateHistory = useCallback(
    (url: URL, scrolls: Readonly<Record<string, number>>) =>
      transition(url, false, scrolls),
    [transition],
  );

  useEffect(() => {
    if (!input.interactive) return;
    const win = window;
    if (win.history.scrollRestoration) win.history.scrollRestoration = "manual";
    let initialUrl = new URL(win.location.href);
    let initialRoute = routeFromUrl(input.catalogue, initialUrl);
    const canonicalInitial = canonicalRouteUrl(initialUrl, initialRoute);
    if (canonicalInitial.href !== initialUrl.href) {
      win.history.replaceState(win.history.state, "", canonicalInitial);
      initialUrl = canonicalInitial;
      initialRoute = routeFromUrl(input.catalogue, initialUrl);
    }
    installedDocumentKey.current = routeDocumentKey(initialUrl);
    persistScroll(win, captureScrolls(document));
    restoreScrolls(document, stateRef.current.regionScrolls);
    if (!sameShellRoute(stateRef.current.route, initialRoute))
      install(initialUrl, false, {}, false);
    const controller = new AbortController();
    let scrollFrame = 0;
    document.addEventListener(
      "scroll",
      () => {
        if (scrollFrame) return;
        const scrolls = captureScrolls(document);
        persistScroll(win, scrolls);
        input.setState((state) => ({ ...state, regionScrolls: scrolls }));
        scrollFrame = win.requestAnimationFrame(() => {
          scrollFrame = 0;
        });
      },
      { capture: true, passive: true, signal: controller.signal },
    );
    win.addEventListener(
      "popstate",
      (event) => {
        const url = new URL(win.location.href);
        const scrolls = historyScrolls(event.state);
        void navigateHistory(url, scrolls);
      },
      { signal: controller.signal },
    );
    return () => {
      controller.abort();
      sequence.current?.abort();
      if (scrollFrame) win.cancelAnimationFrame(scrollFrame);
    };
  }, [
    input.catalogue,
    input.context.delivery,
    input.interactive,
    input.sections,
    input.setState,
    install,
    navigateHistory,
  ]);

  useLayoutEffect(() => {
    if (!input.interactive) return;
    document.title = viewTitle(input.catalogue, input.state.route.view);
    const scrolls = pendingScroll.current;
    if (scrolls) {
      restoreScrolls(document, scrolls);
      pendingScroll.current = undefined;
      requestAnimationFrame(() => restoreScrolls(document, scrolls));
    }
    if (pendingFocus.current) {
      pendingFocus.current = false;
      document
        .querySelector<HTMLElement>("[data-mokly-view]")
        ?.focus({ preventScroll: true });
    }
  }, [input.catalogue, input.interactive, input.state.route]);

  return shellBrowserActions({
    catalogue: input.catalogue,
    context: input.context,
    navigate,
    setState: input.setState,
    state: () => stateRef.current,
    transition,
  });
}
