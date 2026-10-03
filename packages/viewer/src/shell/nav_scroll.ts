/** Catalogue scroll restoration, active-row visibility, and folder reveal. */

import { useLayoutEffect, useRef } from "react";

import type { ShellStore } from "./store_context.js";

/** Bind the rail scroller to recovery state, routes, and folder reveals. */
export function useNavigationScroll(
  store: ShellStore | undefined,
  route: ShellStore["state"]["route"] | undefined,
) {
  const scroll = useRef<HTMLDivElement>(null);
  const initialScroll = useRef(store?.state.navScroll ?? 0);
  const mounted = useRef(false);
  const interactive = store?.interactive ?? false;
  const revealed = store?.state.revealedFolder;
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
  }, [interactive, route]);
  useLayoutEffect(() => {
    const pane = scroll.current;
    if (!interactive || !pane || !revealed) return;
    const summary = [
      ...pane.querySelectorAll<HTMLElement>("details[data-nav-disclosure]"),
    ]
      .find((folder) => folder.dataset["navDisclosure"] === revealed.key)
      ?.querySelector<HTMLElement>(":scope > summary");
    if (!summary) return;
    summary.focus({ preventScroll: true });
    summary.scrollIntoView({ block: "nearest" });
  }, [interactive, revealed]);
  return scroll;
}
