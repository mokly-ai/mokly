import { useId } from "react";

import { mockLink, type Viewport } from "@mokly/mokly";

import {
  CatalogueNavigation,
  type NavigationStatus,
} from "../../../../../../packages/ui/src/catalogue-navigation/catalogue-navigation.js";
import { useCurrentPage } from "../../parts/design_navigation.js";

import {
  navigationSections,
  type NavigationRow,
} from "./catalogue-navigation-sections.js";
import type { CatalogueNavigationProps } from "./catalogue-navigation.js";

type ChangesStatus = NonNullable<CatalogueNavigationProps["changesStatus"]>;

/**
 * The status line under Changes, as the shell words it: the detection at
 * work or failed, or no changed row. It shows only while Changes is chosen,
 * and a ready Changes list with rows hides it.
 */
function navigationStatus(
  changesStatus: ChangesStatus,
  changedOnly: boolean,
  rows: number,
): NavigationStatus {
  return {
    hidden: !changedOnly || (changesStatus === "ready" && rows > 0),
    message: changesStatus === "ready" ? "none" : changesStatus,
  };
}

/**
 * The shipped catalogue navigation. A static artboard runs no script, so the
 * filter links to the artboard that shows the other view, Collapse all and
 * the separator are pictures, and each section keeps its native disclosure.
 * Changes that is not ready shows its status line in place of the rows. Its
 * frame carries the drawer flag that this component's stylesheet draws: the
 * drawer presentation, and every mobile render, draw the open drawer.
 */
export function CatalogueNavigationView({
  activeDestination,
  activeKey,
  activeLabel,
  changedCount,
  changedOnly,
  changesStatus = "ready",
  showChanges = true,
  rows,
  presentation,
  allDestination,
  changesDestination,
  viewport,
}: CatalogueNavigationProps & { viewport: Viewport }) {
  const id = useId();
  const currentPage = useCurrentPage();
  const shown = changedOnly && changesStatus !== "ready" ? [] : rows;
  // The selected row, and a row that opens the artboard itself, are current.
  const current = (row: NavigationRow) =>
    (activeKey !== undefined
      ? row.key === activeKey
      : activeDestination !== undefined
        ? row.to === activeDestination
        : activeLabel !== undefined && row.label === activeLabel) ||
    (row.to !== undefined && currentPage(row.to) === "page");
  const drawer = presentation === "drawer" || viewport === "mobile";
  return (
    <div className="mbk-nav-frame" data-drawer={drawer ? "" : undefined}>
      <CatalogueNavigation
        busy={
          changedOnly &&
          (changesStatus === "pending" || changesStatus === "preparing")
        }
        filter={
          showChanges
            ? {
                count: changedCount,
                status: changesStatus,
                view: changedOnly ? "changes" : "all",
              }
            : undefined
        }
        filterHref={(view) => {
          const to =
            view === "all"
              ? changedOnly
                ? allDestination
                : undefined
              : changedOnly
                ? undefined
                : changesDestination;
          return to === undefined ? undefined : mockLink(to);
        }}
        id={id}
        interactive={false}
        maximumWidth={480}
        operable={false}
        resizable={!drawer}
        sections={navigationSections(shown, { current, id })}
        status={
          showChanges
            ? navigationStatus(changesStatus, changedOnly, shown.length)
            : undefined
        }
        width={248}
      />
    </div>
  );
}
