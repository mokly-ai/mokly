/** Browser URL, history, focus, and scroll integration for the shell store. */

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type {
  Dispatch,
  KeyboardEvent,
  MouseEvent,
  SetStateAction,
} from "react";

import {
  resolveDeliveryHref,
  validFragmentQuery,
} from "../navigation/delivery.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { currentDeploymentMatches } from "./delivery.js";
import type { NavSectionNode } from "./nav_tree.js";
import { routeDocumentKey, routeFromUrl, routeHref } from "./routes.js";
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
  navigateFrame(href: string): void;
  onShellClick(event: MouseEvent<HTMLElement>): void;
  onShellKeyDown(event: KeyboardEvent<HTMLElement>): void;
  openFrame(href: string, target: string): void;
  selectVariant(value: string): void;
}

/** Bind one store to standalone history without reading globals during SSR. */
export function useShellBrowser(input: BrowserStoreInput): ShellBrowserActions {
  const stateRef = useRef(input.state);
  stateRef.current = input.state;
  const displayed = useRef<string | undefined>(undefined);
  const sequence = useRef<AbortController | undefined>(undefined);
  const pendingScroll = useRef<Readonly<Record<string, number>> | undefined>(
    undefined,
  );
  const pendingFocus = useRef(false);

  const install = useCallback(
    (
      url: URL,
      push: boolean,
      scrolls: Readonly<Record<string, number>> = {},
    ) => {
      const win = window;
      sequence.current?.abort();
      const route = routeFromUrl(input.catalogue, url);
      if (push) {
        persistScroll(win, captureScrolls(document));
        win.history.pushState({ scrolls: {} }, "", url);
      }
      displayed.current = routeDocumentKey(url);
      pendingScroll.current = scrolls;
      pendingFocus.current = true;
      input.setState((state) =>
        withRoute(state, route, input.catalogue, input.sections),
      );
    },
    [input.catalogue, input.sections, input.setState],
  );

  const navigate = useCallback(
    async (href: string) => {
      if (!input.interactive) return;
      const win = window;
      const requested = new URL(href, win.location.href);
      const route = routeFromUrl(input.catalogue, requested);
      let canonical = requested;
      if (route.view.kind === "target")
        canonical = new URL(
          routeHref(
            route.view.target.entry.route,
            route.fragment,
            route.variant,
          ),
          requested,
        );
      const controller = new AbortController();
      sequence.current?.abort();
      sequence.current = controller;
      if (
        input.context.delivery &&
        input.catalogue.publicModel &&
        !(await currentDeploymentMatches(
          win,
          input.catalogue.publicModel,
          controller.signal,
        ))
      ) {
        if (!controller.signal.aborted) win.location.assign(canonical.href);
        return;
      }
      if (!controller.signal.aborted) install(canonical, true);
    },
    [input.catalogue, input.context.delivery, input.interactive, install],
  );

  useEffect(() => {
    if (!input.interactive) return;
    const win = window;
    if (win.history.scrollRestoration) win.history.scrollRestoration = "manual";
    if (input.context.delivery && win.location.pathname.startsWith("/id/")) {
      win.history.replaceState(
        win.history.state,
        "",
        `${input.context.delivery.canonicalPath}${validFragmentQuery(win.location.search)}`,
      );
    }
    const initialUrl = new URL(win.location.href);
    displayed.current = routeDocumentKey(initialUrl);
    persistScroll(win, captureScrolls(document));
    restoreScrolls(document, stateRef.current.regionScrolls);
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
        sequence.current?.abort();
        const url = new URL(win.location.href);
        const scrolls = historyScrolls(event.state);
        if (displayed.current === routeDocumentKey(url)) {
          restoreScrolls(document, scrolls);
          return;
        }
        install(url, false, scrolls);
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
      install(url, true);
    },
    [install],
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
      if (
        state.tagPickerOpen &&
        !target.closest("[data-mokly-tag-toggle], #mb-tag-picker")
      )
        input.setState((current) => ({ ...current, tagPickerOpen: false }));
      if (target.closest("[data-mokly-tag-toggle], #mb-tag-picker")) return;
      if (state.expandedFrame && !target.closest(".browser-frame.is-expanded"))
        input.setState((current) => ({ ...current, expandedFrame: undefined }));
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !eligibleAnchor(event, anchor, window.location)) return;
      event.preventDefault();
      void navigate(anchor.href);
    },
    onShellKeyDown: (event) => {
      if (event.key !== "Escape") return;
      if (stateRef.current.tagPickerOpen) {
        event.preventDefault();
        input.setState((state) => ({ ...state, tagPickerOpen: false }));
        document.querySelector<HTMLElement>("[data-mokly-tag-toggle]")?.focus();
      } else if (stateRef.current.expandedFrame) {
        event.preventDefault();
        input.setState((state) => ({ ...state, expandedFrame: undefined }));
      }
    },
  };
}

function eligibleAnchor(
  event: MouseEvent<HTMLElement>,
  anchor: HTMLAnchorElement,
  location: Location,
): boolean {
  const url = new URL(anchor.href, location.href);
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !anchor.hasAttribute("download") &&
    (!anchor.target || anchor.target === "_self") &&
    url.origin === location.origin &&
    !(
      routeDocumentKey(url) === routeDocumentKey(new URL(location.href)) &&
      url.hash !== ""
    ) &&
    (url.pathname === "/" ||
      url.pathname.startsWith("/view/") ||
      url.pathname.startsWith("/id/"))
  );
}
