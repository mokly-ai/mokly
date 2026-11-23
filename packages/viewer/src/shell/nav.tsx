/**
 * The catalogue column. This container reads the store, the identifier
 * scope, and the shared hierarchy, builds the column's records, and
 * `@mokly/ui/catalogue-navigation` renders them. The scroll restoration,
 * the folder reveal, and the drag mark on the shell root stay here, because
 * they read the store or span the shell root.
 */

import { useMemo } from "react";

import { CatalogueNavigation } from "@mokly/ui/catalogue-navigation";

import type { ShellContext } from "./context.js";
import {
  useShellIdentifier,
  useShellIdentifierScope,
} from "./identifier_context.js";
import { navFilter, navStatus } from "./nav_filter.js";
import { useNavigationResize } from "./nav_resize.js";
import { navSection } from "./nav_rows.js";
import { useNavigationScroll } from "./nav_scroll.js";
import { useLatestShellStore, useShellStore } from "./store_context.js";

/** The served catalogue navigation column. */
export function CatalogueNav({ context }: { context: ShellContext }) {
  const store = useShellStore();
  const latest = useLatestShellStore(store);
  const navigationId = useShellIdentifier("mb-nav");
  const identifier = useShellIdentifierScope();

  const resize = useNavigationResize(store, latest);
  const { context: runtimeContext, interactive, sections } = store;
  const {
    disclosures,
    filterBaseline,
    selection: { view, search, tags },
  } = store.state;
  const { activeId } = context;
  const navSelection = useMemo(
    () => ({ view, search, tags }),
    [view, search, tags],
  );
  const rows = useMemo(
    () =>
      sections.map((section) =>
        navSection(section, {
          activeId,
          context: runtimeContext,
          identifier,
          state: { disclosures, filterBaseline, selection: navSelection },
        }),
      ),
    [
      activeId,
      disclosures,
      filterBaseline,
      identifier,
      navSelection,
      runtimeContext,
      sections,
    ],
  );
  const scroll = useNavigationScroll(store, rows);
  const actions = useMemo(
    () => ({
      onCollapseAll: () => latest.current.collapseAll(),
      onDisclosure: (key: string, open: boolean) =>
        latest.current.setDisclosure(key, open),
      onScroll: (top: number) => latest.current.setNavScroll(top),
      onView: (view: "all" | "changes") => latest.current.setView(view),
    }),
    [latest],
  );
  return useMemo(() => {
    const filter = navFilter(context, navSelection.view);
    return (
      <CatalogueNavigation
        {...actions}
        {...resize}
        {...scroll}
        busy={
          navSelection.view === "changes" &&
          (filter?.status === "pending" || filter?.status === "preparing")
        }
        filter={filter}
        id={navigationId}
        interactive={interactive}
        sections={rows}
        status={navStatus(context, navSelection, rows)}
      />
    );
  }, [
    actions,
    context,
    interactive,
    navSelection,
    navigationId,
    resize,
    rows,
    scroll,
  ]);
}
