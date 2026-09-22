/** Browser URL, history, focus, and scroll integration for the shell store. */

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type {
  Dispatch,
  KeyboardEvent,
  MouseEvent,
  SetStateAction,
} from "react";

import type { FrameNavigation } from "../client/frame_adapter.js";
import {
  resolveDeliveryHref,
  validFragmentQuery,
} from "../navigation/delivery.js";

import type { Catalogue } from "./catalogue.js";
import { changesActivation } from "./changes_activation.js";
import type { ShellContext } from "./context.js";
import { currentDeploymentMatches } from "./delivery.js";
import type { NavSectionNode } from "./nav_tree.js";
import { routeDocumentKey, routeFromUrl, routeHref } from "./routes.js";
import { eligibleShellAnchor, sameShellRoute } from "./store_browser_routes.js";
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

/** Browser-only actions returned to the React shell provider. */
export interface ShellBrowserActions {
  navigateFrame(href: string, navigation?: FrameNavigation): void;
  onShellClick(event: MouseEvent<HTMLElement>): void;
  onShellKeyDown(event: KeyboardEvent<HTMLElement>): void;
  openFrame(href: string, target: string): void;
  selectVariant(value: string): void;
}

/** Bind one store to standalone history without reading globals during SSR. */
export function useShellBrowser(input: BrowserStoreInput): ShellBrowserActions {
  const stateRef = useRef(input.state);
  stateRef.current = input.state;
  const sequence = useRef<AbortController | undefined>(undefined);
  const providerNormalizedRoutes = useRef(false);
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
      const route =
        activated ?? routeFromUrl(input.catalogue, url, input.context.delivery);
      if (push) {
        persistScroll(win, captureScrolls(document));
        win.history.pushState({ scrolls: {} }, "", url);
      }
      installedDocumentKey.current = routeDocumentKey(url);
      if (restore) {
        pendingScroll.current = scrolls;
        pendingFocus.current = true;
      }
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
      const requestedRoute = routeFromUrl(
        input.catalogue,
        requested,
        input.context.delivery,
      );
      let canonical = requested;
      if (requestedRoute.view.kind === "target")
        canonical = new URL(
          browserRouteHref(
            routeHref(
              requestedRoute.view.target.entry.route,
              requestedRoute.fragment,
              requestedRoute.variant,
              requestedRoute,
            ),
            providerNormalizedRoutes.current,
          ),
          requested,
        );
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
    providerNormalizedRoutes.current = isProviderNormalizedRoute(
      win.location.pathname,
      input.context.delivery?.canonicalPath,
    );
    if (
      input.context.delivery &&
      win.location.pathname.startsWith("/id/") &&
      !new URLSearchParams(win.location.search).has("snapshot")
    ) {
      win.history.replaceState(
        win.history.state,
        "",
        `${input.context.delivery.canonicalPath}${validFragmentQuery(win.location.search)}`,
      );
    }
    let initialUrl = new URL(win.location.href);
    let initialRoute = routeFromUrl(
      input.catalogue,
      initialUrl,
      input.context.delivery,
    );
    const canonicalInitial = canonicalHistoricalUrl(
      initialUrl,
      initialRoute,
      providerNormalizedRoutes.current,
    );
    if (canonicalInitial.href !== initialUrl.href) {
      win.history.replaceState(win.history.state, "", canonicalInitial);
      initialUrl = canonicalInitial;
      initialRoute = routeFromUrl(
        input.catalogue,
        initialUrl,
        input.context.delivery,
      );
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

  const openFrame = useCallback(
    (href: string, target: string) => {
      const resolved = resolveDeliveryHref(href, input.context.delivery);
      if (resolved) window.open(resolved, target, "noopener");
    },
    [input.context.delivery],
  );
  const selectVariant = useCallback(
    (value: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set("variant", value);
      url.searchParams.delete("instance");
      void navigate(url.href);
    },
    [navigate],
  );
  return {
    navigateFrame: (href) => {
      const target = resolveDeliveryHref(href, input.context.delivery) ?? href;
      setTimeout(() => void navigate(target), 0);
    },
    openFrame,
    selectVariant,
    onShellClick: (event) => {
      const target = event.target instanceof Element ? event.target : undefined;
      if (!target) return;
      const state = stateRef.current;
      const outsidePickerTag =
        target.closest("[data-mokly-tag]") &&
        !target.closest("[data-mokly-tag-picker]");
      if (
        state.tagPickerOpen &&
        !target.closest("[data-mokly-tag-toggle], [data-mokly-tag-picker]")
      ) {
        input.setState((current) => ({ ...current, tagPickerOpen: false }));
        if (outsidePickerTag) {
          const root = event.currentTarget;
          queueMicrotask(() =>
            root.querySelector<HTMLElement>("[data-mokly-tag-toggle]")?.focus(),
          );
        }
      }
      if (target.closest("[data-mokly-tag-toggle], [data-mokly-tag-picker]"))
        return;
      if (state.expandedFrame && !target.closest(".browser-frame.is-expanded"))
        input.setState((current) => ({ ...current, expandedFrame: undefined }));
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !eligibleShellAnchor(event, anchor, window.location))
        return;
      event.preventDefault();
      const requested = new URL(anchor.href, window.location.href);
      const route = routeFromUrl(
        input.catalogue,
        requested,
        input.context.delivery,
      );
      const activated = anchor.hasAttribute("data-nav-row")
        ? changesActivation(
            input.catalogue,
            input.context,
            state.selection,
            route,
          )
        : route;
      if (activated === route || activated.view.kind !== "target") {
        void navigate(requested.href);
        return;
      }
      const href = routeHref(
        activated.view.target.entry.route,
        activated.fragment,
        activated.variant,
        {
          ...(activated.comparison ? { comparison: activated.comparison } : {}),
          ...(activated.instance ? { instance: activated.instance } : {}),
          ...(activated.snapshot ? { snapshot: activated.snapshot } : {}),
          ...(activated.variantValues
            ? { variantValues: activated.variantValues }
            : {}),
        },
      );
      void transition(new URL(href, requested), true, {}, activated);
    },
    onShellKeyDown: (event) => {
      if (event.key !== "Escape") return;
      if (stateRef.current.tagPickerOpen) {
        event.preventDefault();
        input.setState((state) => ({ ...state, tagPickerOpen: false }));
        event.currentTarget
          .querySelector<HTMLElement>("[data-mokly-tag-toggle]")
          ?.focus();
      } else if (stateRef.current.expandedFrame) {
        event.preventDefault();
        input.setState((state) => ({ ...state, expandedFrame: undefined }));
      }
    },
  };
}

/** Pin an inferred historical route before later catalogue evidence can change. */
export function canonicalHistoricalUrl(
  url: URL,
  route: ReturnType<typeof routeFromUrl>,
  providerNormalized: boolean,
): URL {
  if (
    route.view.kind !== "target" ||
    !route.snapshot ||
    url.searchParams.has("snapshot")
  )
    return url;
  return new URL(
    browserRouteHref(
      routeHref(
        route.view.target.entry.route,
        route.fragment,
        route.variant,
        route,
      ),
      providerNormalized,
    ),
    url,
  );
}

function isProviderNormalizedRoute(
  pathname: string,
  canonicalPath: string | undefined,
): boolean {
  return (
    canonicalPath?.endsWith(".html") === true &&
    pathname === canonicalPath.slice(0, -5)
  );
}

function browserRouteHref(href: string, providerNormalized: boolean): string {
  return providerNormalized ? href.replace(/\.html(?=\?|$)/, "") : href;
}
