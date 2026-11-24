/** Catalogue scroll restoration, active-row visibility, and folder reveal. */

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type {
  NavigationRow,
  NavigationSection,
} from "@mokly/ui/catalogue-tree";

import { routeKey } from "./data_requests.js";
import { ElementRefs } from "./element_refs.js";
import { sameNavFilters } from "./nav_reveal.js";
import type { ShellStore } from "./store_context.js";

/** Bind the rail scroller to its stored offset, routes, and folder reveals. */
export function useNavigationScroll(
  store: ShellStore,
  sections: readonly NavigationSection[],
) {
  const currentRow = useRef<HTMLAnchorElement>(null);
  const [summaries] = useState(() => new ElementRefs<string, HTMLElement>());
  const visible = useMemo(() => visibleSummaries(sections), [sections]);
  const scroll = useRef<HTMLDivElement>(null);
  const initialScroll = useRef(store.state.navScroll);
  const mounted = useRef(false);
  const settled = useRef<ShellStore["state"]["revealedFolder"]>(undefined);
  const { interactive } = store;
  const {
    revealedFolder: revealed,
    route,
    routeInstallation,
    selection,
  } = store.state;
  const currentKey = routeKey(route);
  const entryKind =
    route.view.kind === "target" ? route.view.target.entry.kind : undefined;
  const scrolledRoute = useRef(routeInstallation);
  useLayoutEffect(() => {
    const pane = scroll.current;
    if (!interactive || !pane) return;
    if (!mounted.current) {
      mounted.current = true;
      scrolledRoute.current = routeInstallation;
      pane.scrollTop = initialScroll.current;
      return;
    }
    if (scrolledRoute.current === routeInstallation) return;
    scrolledRoute.current = routeInstallation;
    currentRow.current?.scrollIntoView({ block: "nearest" });
  }, [interactive, currentKey, entryKind, routeInstallation]);
  useLayoutEffect(() => {
    const pane = scroll.current;
    if (!interactive || !pane || !revealed) return;
    if (settled.current === revealed) return;
    const summary = visible.has(revealed.key)
      ? summaries.ref(revealed.key).current
      : undefined;
    if (summary) {
      summary.focus({ preventScroll: true });
      summary.scrollIntoView({ block: "nearest" });
    }
    if (summary || !sameNavFilters(selection, revealed.selection))
      settled.current = revealed;
  }, [interactive, revealed, selection, summaries, visible]);
  return useMemo(
    () => ({
      scrollRef: scroll,
      currentRowRef: currentRow,
      summaryRef: summaries.ref,
    }),
    [summaries],
  );
}

/** Filter visibility comes from the same records the package renders. */
function visibleSummaries(sections: readonly NavigationSection[]): Set<string> {
  const visible = new Set<string>();
  const visit = (rows: readonly NavigationRow[]) => {
    for (const row of rows) {
      if (row.kind === "folder") {
        if (row.hidden) continue;
        visible.add(row.disclosure);
        visit(row.rows);
      } else if (row.list?.open && !row.list.hidden) visit(row.list.rows);
    }
  };
  for (const section of sections) {
    if (section.hidden) continue;
    visible.add(section.disclosure);
    visit(section.rows);
  }
  return visible;
}
