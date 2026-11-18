/**
 * The catalogue column. This container reads the store, the identifier
 * scope, and the shared hierarchy, builds the column's records, and
 * `@mokly/ui/catalogue-navigation` renders them. The scroll restoration,
 * the folder reveal, and the drag mark on the shell root stay here, because
 * they read the store or span the shell root.
 */

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
import { useShellStore } from "./store_context.js";

/** The served catalogue navigation column. */
export function CatalogueNav({ context }: { context: ShellContext }) {
  const store = useShellStore();
  const navigationId = useShellIdentifier("mb-nav");
  const identifier = useShellIdentifierScope();

  const resize = useNavigationResize(store);
  const changesStatus = context.changedEntries
    ? "ready"
    : context.changesStatus;
  const source = { context, identifier, store };
  const rows = store.sections.map((section) => navSection(section, source));
  const scroll = useNavigationScroll(store, rows);
  return (
    <CatalogueNavigation
      busy={
        store.state.selection.view === "changes" &&
        (changesStatus === "pending" || changesStatus === "preparing")
      }
      filter={navFilter(context, store)}
      id={navigationId}
      interactive={store.interactive}
      maximumWidth={resize.maximumWidth}
      onCollapseAll={() => store.collapseAll()}
      onDisclosure={(key, open) => store.setDisclosure(key, open)}
      onResizing={resize.onResizing}
      onScroll={(top) => store.setNavScroll(top)}
      onView={(view) => store.setView(view)}
      onWidth={resize.onWidth}
      onWidthCommit={resize.onWidthCommit}
      ref={resize.ref}
      resizable={resize.resizable}
      {...scroll}
      sections={rows}
      status={navStatus(context, store)}
      width={resize.width}
    />
  );
}
