import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import { NavTree } from "../../parts/nav.js";
import { Shell, type ArtboardViewport } from "../../parts/shell.js";

import {
  COMPONENT_PAGES,
  type ComponentDesignDestination,
} from "./destinations.js";
import { REMOVED_STORY_NODES } from "./navigation_tree.js";

/** The entries that the removed story's Changes filter holds. */
const CHANGED_COUNT = 2;

/**
 * The existing shell and navigation around the component explorer's removed
 * story. A phone's shortcuts open the Canvas artboards of the screens and the
 * components, and Changes opens the removed variant.
 */
export function ExplorerShell({
  activeKey,
  children,
  design,
  viewport,
}: {
  activeKey?: string | undefined;
  children: ReactNode;
  design: ComponentDesignDestination;
  viewport: ArtboardViewport;
}) {
  const changes = COMPONENT_PAGES.removed;
  const navProps = {
    activeDestination: design,
    changedCount: CHANGED_COUNT,
    changedOnly: true,
    nodes: REMOVED_STORY_NODES,
    ...(activeKey === undefined ? {} : { activeKey }),
  };
  return (
    <Shell design={design} viewport={viewport} nav={<NavTree {...navProps} />}>
      {viewport === "mobile" ? (
        <nav className="ce-mobile-location" aria-label="Catalogue shortcuts">
          <MockLink to={CANVAS_PAGES.selection}>Screens</MockLink>
          <MockLink to={CANVAS_PAGES.componentSet}>Components</MockLink>
          <MockLink
            to={changes}
            aria-current={changes === design ? "page" : undefined}
          >
            Changes <span className="ce-change-count">{CHANGED_COUNT}</span>
          </MockLink>
        </nav>
      ) : null}
      {children}
    </Shell>
  );
}
