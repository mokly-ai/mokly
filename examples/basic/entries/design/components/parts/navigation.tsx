import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { NavTree, type NavNode } from "../../parts/nav.js";
import { Shell, type ArtboardViewport } from "../../parts/shell.js";

import {
  COMPONENT_PAGES,
  INSPECTION_PAGES,
  type WorkspaceDesignDestination,
} from "./destinations.js";
import type { CatalogueIdentity } from "./metadata.js";

export type ChangeScenario =
  "all" | "component" | "screen" | "removed" | "added";

function nodes(
  scenario: ChangeScenario,
  active: CatalogueIdentity,
  design: WorkspaceDesignDestination,
): NavNode[] {
  if (scenario === "added")
    return [
      {
        key: "components",
        depth: 0,
        kind: "collection",
        label: "Components",
        count: 1,
        open: true,
      },
      {
        key: "badge",
        depth: 1,
        kind: "component",
        label: "Badge",
        to: COMPONENT_PAGES.added,
      },
    ];
  const reading = active === "reading-room";
  const destination = (
    identity: CatalogueIdentity,
    canonical: WorkspaceDesignDestination,
  ) => (active === identity ? design : canonical);
  const screens: NavNode[] =
    scenario === "component"
      ? []
      : [
          {
            key: "screens",
            depth: 0,
            kind: "collection",
            label: "Screens",
            count:
              scenario === "screen" || scenario === "removed"
                ? 1
                : reading
                  ? 3
                  : 2,
            open: true,
          },
          {
            key: "selected-screen",
            depth: 1,
            kind: "screen",
            label: scenario === "removed" ? "Farewell" : "Welcome",
            to: destination(
              scenario === "removed" ? "farewell" : "welcome",
              scenario === "removed"
                ? INSPECTION_PAGES["removed-consumer"]
                : scenario === "screen"
                  ? INSPECTION_PAGES["direct-change"]
                  : INSPECTION_PAGES.details,
            ),
          },
          ...(scenario === "all"
            ? [
                {
                  key: "details",
                  depth: 1,
                  kind: "screen" as const,
                  label: "Details",
                  to: destination("details", INSPECTION_PAGES.consumer),
                },
              ]
            : []),
          ...(reading
            ? [
                {
                  key: "reading-room",
                  depth: 1,
                  kind: "screen" as const,
                  label: "Reading room",
                  to: destination("reading-room", INSPECTION_PAGES.empty),
                },
              ]
            : []),
        ];
  return [
    ...screens,
    {
      key: "components",
      depth: 0,
      kind: "collection",
      label: "Components",
      count: scenario === "all" ? 4 : 1,
      open: true,
    },
    {
      key: "action",
      depth: 1,
      kind: "component",
      label: "Action",
      to: destination(
        "action",
        scenario === "removed"
          ? COMPONENT_PAGES.removed
          : scenario === "all"
            ? COMPONENT_PAGES.default
            : COMPONENT_PAGES.affected,
      ),
    },
    ...(scenario === "all"
      ? [
          {
            key: "toolbar",
            depth: 1,
            kind: "component" as const,
            label: "Toolbar",
            to: destination("toolbar", COMPONENT_PAGES.toolbar),
          },
          {
            key: "help-hint",
            depth: 1,
            kind: "component" as const,
            label: "Help hint",
            to: destination("help-hint", COMPONENT_PAGES.hidden),
          },
          {
            key: "badge",
            depth: 1,
            kind: "component" as const,
            label: "Badge",
            to: destination("badge", COMPONENT_PAGES.unused),
          },
        ]
      : []),
  ];
}

/** Existing shell and navigation composed around the component design scenario. */
export function ExplorerShell({
  active = "action",
  children,
  design,
  scenario = "all",
  viewport,
}: {
  active?: CatalogueIdentity;
  children: ReactNode;
  design: WorkspaceDesignDestination;
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
    nodes: nodes(scenario, active, design),
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
          <MockLink to="design-component-inspection-details">Screens</MockLink>
          <MockLink to="design-component-overview">Components</MockLink>
          {scenario === "all" ? (
            <span>
              Changes <span className="ce-change-count">0</span>
            </span>
          ) : (
            <MockLink
              to={
                scenario === "added"
                  ? COMPONENT_PAGES.added
                  : scenario === "removed"
                    ? "design-component-removed"
                    : scenario === "screen"
                      ? "design-component-inspection-direct-change"
                      : "design-component-affected"
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
