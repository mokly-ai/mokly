import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import {
  COMPONENT_NAVIGATION,
  componentVariantRows,
  type ComponentNavigationIdentity,
} from "../../parts/component_nav_data.js";
import { NavTree, type NavNode } from "../../parts/nav.js";
import { Shell, type ArtboardViewport } from "../../parts/shell.js";

import {
  COMPONENT_PAGES,
  INSPECTION_PAGES,
  type ComponentDesignDestination,
} from "./destinations.js";
import type { CatalogueIdentity } from "./metadata.js";
import {
  isStyleScenario,
  STYLE_CHANGES,
  styleScenarioRows,
  type StyleScenario,
} from "./style_navigation.js";

export type ChangeScenario =
  | "all"
  | "component"
  | "screen"
  | "removed"
  | "added"
  | "checklist"
  | StyleScenario;

/** Scenarios whose Changes hold one component outside Action's story. */
const SOLE_CHANGES = {
  added: { key: "badge", label: "Badge", to: COMPONENT_PAGES.added },
  checklist: {
    key: "checklist",
    label: "Checklist",
    to: COMPONENT_PAGES["overlay-tall"],
  },
} as const;

function nodes(
  scenario: Exclude<ChangeScenario, StyleScenario>,
  active: CatalogueIdentity,
  design: ComponentDesignDestination,
  activeKey?: string,
): NavNode[] {
  const linkedVariants = (
    rows: readonly NavNode[],
    destination?: ComponentDesignDestination,
  ): NavNode[] =>
    rows.map((row) => ({
      ...row,
      ...(scenario === "removed" ? {} : { changed: scenario !== "all" }),
      ...(row.key === activeKey
        ? { to: design }
        : destination === undefined
          ? {}
          : { to: destination }),
    }));
  const componentBranch = (
    identity: ComponentNavigationIdentity,
    to: ComponentDesignDestination,
    variants: readonly NavNode[] = componentVariantRows(identity, 2),
    variantDestination?: ComponentDesignDestination,
  ): NavNode[] => [
    {
      key: COMPONENT_NAVIGATION[identity].id,
      changed: scenario !== "all",
      depth: 1,
      kind: "component",
      label: COMPONENT_NAVIGATION[identity].title,
      to,
      variants: "open",
    },
    ...linkedVariants(variants, variantDestination),
  ];
  if (scenario === "added" || scenario === "checklist") {
    const identity = scenario === "added" ? "badge" : "checklist";
    const { to } = SOLE_CHANGES[scenario];
    const variants = componentVariantRows(identity, 2);
    return [
      {
        key: "components",
        depth: 0,
        kind: "folder",
        label: "Components",
        count: 1,
        open: true,
      },
      ...componentBranch(identity, to, variants, to),
    ];
  }
  const reading = active === "reading-room";
  const destination = (
    identity: CatalogueIdentity,
    canonical: ComponentDesignDestination,
  ) => (active === identity ? design : canonical);
  const screens: NavNode[] =
    scenario === "component"
      ? []
      : [
          {
            key: "screens",
            depth: 0,
            kind: "folder",
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
      kind: "folder",
      label: "Components",
      count: scenario === "all" ? 4 : 1,
      open: true,
    },
    ...componentBranch(
      "action",
      scenario === "all"
        ? destination("action", COMPONENT_PAGES.default)
        : scenario === "removed"
          ? activeKey === "example-action-compact"
            ? design
            : COMPONENT_PAGES.removed
          : activeKey === COMPONENT_NAVIGATION.action.id ||
              activeKey === COMPONENT_NAVIGATION.action.variants[0].id
            ? design
            : COMPONENT_PAGES.affected,
      scenario === "removed"
        ? [
            {
              key: "example-action-compact",
              depth: 2,
              kind: "variant",
              label: "Compact · Removed",
              to: COMPONENT_PAGES.removed,
              variantParentKind: "component",
            },
          ]
        : scenario === "all"
          ? componentVariantRows("action", 2)
          : componentVariantRows("action", 2).slice(0, 1),
      scenario === "all"
        ? undefined
        : scenario === "removed"
          ? COMPONENT_PAGES.removed
          : COMPONENT_PAGES.affected,
    ),
    ...(scenario === "all"
      ? [
          ...componentBranch(
            "toolbar",
            destination("toolbar", COMPONENT_PAGES.toolbar),
          ),
          ...componentBranch(
            "help-hint",
            destination("help-hint", COMPONENT_PAGES.hidden),
          ),
          ...componentBranch(
            "badge",
            destination("badge", COMPONENT_PAGES.unused),
          ),
        ]
      : []),
  ];
}

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
  const navProps = {
    activeDestination: design,
    changedCount:
      style?.count ??
      (scenario === "all"
        ? 0
        : scenario === "screen" || scenario === "removed"
          ? 2
          : 1),
    changedOnly: scenario !== "all",
    nodes: isStyleScenario(scenario)
      ? styleScenarioRows(scenario)
      : nodes(scenario, active, design, activeKey),
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
          <MockLink to="design-component-inspection-details">Screens</MockLink>
          <MockLink to="design-component-overview">Components</MockLink>
          {scenario === "all" ? (
            <span>
              Changes <span className="ce-change-count">0</span>
            </span>
          ) : (
            <MockLink
              to={
                style
                  ? style.to
                  : scenario === "added" || scenario === "checklist"
                    ? SOLE_CHANGES[scenario].to
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
