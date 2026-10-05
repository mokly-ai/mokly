/** Catalogue scroll restoration, active-row visibility, and folder reveal. */

import { useLayoutEffect, useRef } from "react";

import { sameNavFilters } from "./nav_reveal.js";
import type { ShellStore } from "./store_context.js";

/** Bind the rail scroller to recovery state, routes, and folder reveals. */
export function useNavigationScroll(
  store: ShellStore | undefined,
  route: ShellStore["state"]["route"] | undefined,
) {
  const scroll = useRef<HTMLDivElement>(null);
  const initialScroll = useRef(store?.state.navScroll ?? 0);
  const mounted = useRef(false);
  const settled = useRef<ShellStore["state"]["revealedFolder"]>(undefined);
  const interactive = store?.interactive ?? false;
  const revealed = store?.state.revealedFolder;
  const selection = store?.state.selection;
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
    if (!interactive || !pane || !revealed || !selection) return;
    if (settled.current === revealed) return;
    const summary = shownFolderSummary(pane, revealed.key);
    if (summary) {
      summary.focus({ preventScroll: true });
      summary.scrollIntoView({ block: "nearest" });
    }
    if (summary || !sameNavFilters(selection, revealed.selection))
      settled.current = revealed;
  }, [interactive, revealed, selection]);
  return scroll;
}

/**
 * The summary of a revealed folder once its row shows. An application-owned
 * host can commit the reveal's cleared filters after the request, so the row
 * may still be hidden when the reveal starts.
 */
function shownFolderSummary(
  pane: HTMLElement,
  key: string,
): HTMLElement | undefined {
  const folder = [
    ...pane.querySelectorAll<HTMLElement>("details[data-nav-disclosure]"),
  ].find((candidate) => candidate.dataset["navDisclosure"] === key);
  if (!folder || folder.closest("[hidden]")) return undefined;
  return folder.querySelector<HTMLElement>(":scope > summary") ?? undefined;
}
