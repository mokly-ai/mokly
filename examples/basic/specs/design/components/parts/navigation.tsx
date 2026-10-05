import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { NavTree } from "../../parts/nav.js";
import { Shell, type ArtboardViewport } from "../../parts/shell.js";

import type { ComponentDesignDestination } from "./destinations.js";
import type { CatalogueIdentity } from "./metadata.js";
import {
  explorerNodes,
  SOLE_CHANGES,
  type ChangeScenario,
} from "./navigation_tree.js";

/** Existing shell and navigation composed around the component design scenario. */
export function ExplorerShell({
  active = "action",
  activeKey,
  children,
  design,
  scenario = "all",
  viewport,
}: {
  active?: CatalogueIdentity;
  activeKey?: string | undefined;
  children: ReactNode;
  design: ComponentDesignDestination;
  scenario?: ChangeScenario;
  viewport: ArtboardViewport;
}) {
  const navProps = {
    activeDestination: design,
    changedCount:
      scenario === "all"
        ? 0
        : scenario === "screen" || scenario === "removed"
          ? 2
          : 1,
    changedOnly: scenario !== "all",
    nodes: explorerNodes(scenario, active, design, activeKey),
    ...(activeKey === undefined ? {} : { activeKey }),
  };
  return (
    <Shell
      menuPresentation="icon"
      design={design}
      searchPlaceholder="Search catalogue…"
      viewport={viewport}
      nav={<NavTree {...navProps} />}
    >
      {viewport === "mobile" ? (
        <nav className="ce-mobile-location" aria-label="Catalogue shortcuts">
          <MockLink to="design/components/inspection/inspection-details">
            Screens
          </MockLink>
          <MockLink to="design/components/overview">Components</MockLink>
          {scenario === "all" ? (
            <span>
              Changes <span className="ce-change-count">0</span>
            </span>
          ) : (
            <MockLink
              to={
                scenario === "added" || scenario === "checklist"
                  ? SOLE_CHANGES[scenario].to
                  : scenario === "removed"
                    ? "design/components/states/removed"
                    : scenario === "screen"
                      ? "design/components/inspection/inspection-direct-change"
                      : "design/components/pages/affected"
              }
            >
              Changes{" "}
              <span className="ce-change-count">{navProps.changedCount}</span>
            </MockLink>
          )}
        </nav>
      ) : null}
      {children}
    </Shell>
  );
}
