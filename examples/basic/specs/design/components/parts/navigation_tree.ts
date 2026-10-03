import {
  COMPONENT_NAVIGATION,
  componentVariantRows,
  type ComponentNavigationIdentity,
} from "../../parts/component_nav_data.js";
import { DESTINATIONS } from "../../parts/destinations.js";
import type { NavNode } from "../../parts/nav.js";

import {
  COMPONENT_PAGES,
  INSPECTION_PAGES,
  type ComponentDesignDestination,
} from "./destinations.js";
import type { CatalogueIdentity } from "./metadata.js";

export type ChangeScenario =
  "all" | "component" | "screen" | "removed" | "added" | "checklist";

/** Scenarios whose Changes hold one component outside Action's story. */
export const SOLE_CHANGES = {
  added: { key: "badge", label: "Badge", to: COMPONENT_PAGES.added },
  checklist: {
    key: "checklist",
    label: "Checklist",
    to: COMPONENT_PAGES["overlay-tall"],
  },
} as const;

/**
 * The explorer's catalogue is one tree under the Example folder, so Example
 * appears in Specs above Screens and in Components above the component library,
 * each with only that section's children. From All, Example's README is its
 * first row; Changes keeps only the changed rows and their folders.
 */
export function explorerNodes(
  scenario: ChangeScenario,
  active: CatalogueIdentity,
  design: ComponentDesignDestination,
  activeKey?: string,
): NavNode[] {
  return [
    {
      key: "example",
      depth: 0,
      kind: "folder",
      label: "Example",
      open: true,
    },
    ...(scenario === "all"
      ? [
          {
            key: "example-overview",
            depth: 1,
            kind: "document" as const,
            label: "Overview",
            to: DESTINATIONS.exampleOverview,
          },
        ]
      : []),
    ...exampleMembers(scenario, active, design, activeKey).map((row) => ({
      ...row,
      depth: row.depth + 1,
    })),
  ];
}

/** Example's Screens and Components folders for one scenario, from depth 0. */
function exampleMembers(
  scenario: ChangeScenario,
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
