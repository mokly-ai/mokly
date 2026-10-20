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
import { isStyleScenario, STYLE_CHANGES } from "./style_navigation.js";

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
  const style = isStyleScenario(scenario) ? STYLE_CHANGES[scenario] : undefined;
  // The shell below provides the artboard's DesignNavigation, so the
  // shortcuts compare with the artboard directly.
  const current = (to: string) => (to === design ? "page" : undefined);
  const changes = style
    ? style.to
    : scenario === "added" || scenario === "checklist"
      ? SOLE_CHANGES[scenario].to
      : scenario === "removed"
        ? "design/components/states/removed"
        : scenario === "screen"
          ? "design/components/inspection/inspection-direct-change"
          : "design/components/pages/affected";
  const navProps = {
    activeDestination: design,
    changedCount:
      style?.count ??
      (scenario === "all"
        ? 0
        : scenario === "screen" || scenario === "removed"
          ? 2
          : 1),
    changedOnly: scenario !== "all" && scenario !== "styles-all",
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
          <MockLink
            to="design/components/inspection/inspection-details"
            aria-current={current(
              "design/components/inspection/inspection-details",
            )}
          >
            Screens
          </MockLink>
          <MockLink
            to="design/components/overview"
            aria-current={current("design/components/overview")}
          >
            Components
          </MockLink>
          {scenario === "all" ? (
            <span>
              Changes <span className="ce-change-count">0</span>
            </span>
          ) : (
            <MockLink to={changes} aria-current={current(changes)}>
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
