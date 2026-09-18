/** Catalogue scroll restoration and active-row visibility. */

import { useLayoutEffect, useRef } from "react";

import type { ShellStore } from "./store_context.js";

/** Bind the rail scroller to recovery state and route visibility. */
export function useNavigationScroll(
  store: ShellStore | undefined,
  activeRoute: string | undefined,
) {
  const scroll = useRef<HTMLDivElement>(null);
  const initialScroll = useRef(store?.state.navScroll ?? 0);
  const mounted = useRef(false);
  const interactive = store?.interactive ?? false;
  useLayoutEffect(() => {
    const pane = scroll.current;
    if (!interactive || !pane) return;
    if (!mounted.current) {
      mounted.current = true;
      pane.scrollTop = initialScroll.current;
      return;
    }
    pane
      .querySelector<HTMLElement>('[data-nav-row][aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeRoute, interactive]);
  return scroll;
}
