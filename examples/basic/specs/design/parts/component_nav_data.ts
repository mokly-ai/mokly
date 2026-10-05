import { COMPONENT_PAGES } from "../components/parts/destinations.js";
import type { CatalogueNavigationProps } from "../library/chrome/catalogue-navigation.js";

type NavigationRow = CatalogueNavigationProps["rows"][number];
type NavigationRows = CatalogueNavigationProps["rows"];

/** Components depicted in the example catalogue and component explorer. */
export type ComponentNavigationIdentity =
  "action" | "toolbar" | "help-hint" | "badge" | "checklist" | "link-button";

interface ComponentVariantNavigationDefinition {
  id: string;
  title: string;
  to?: NavigationRow["to"];
}

interface ComponentNavigationDefinition {
  id: string;
  title: string;
  variants: readonly ComponentVariantNavigationDefinition[];
}

/**
 * Action and Toolbar mirror the real example registrations. Help hint and Badge
 * are synthetic component-explorer fixtures with the saved Default state their
 * mockups depict. Link button is a removed top-level fixture whose variants
 * moved to other components, so it has no variant rows.
 */
export const COMPONENT_NAVIGATION = {
  action: {
    id: "example/components/action",
    title: "Action",
    variants: [
      {
        id: "example/components/action/default",
        title: "Default",
        to: COMPONENT_PAGES.default,
      },
      {
        id: "example/components/action/disabled",
        title: "Disabled",
        to: COMPONENT_PAGES.disabled,
      },
      { id: "example/components/action/secondary", title: "Secondary" },
    ],
  },
  toolbar: {
    id: "example/components/toolbar",
    title: "Toolbar",
    variants: [
      {
        id: "example/components/toolbar/default",
        title: "Default",
        to: COMPONENT_PAGES.toolbar,
      },
    ],
  },
  "help-hint": {
    id: "help-hint",
    title: "Help hint",
    variants: [
      { id: "help-hint-default", title: "Default", to: COMPONENT_PAGES.hidden },
    ],
  },
  badge: {
    id: "badge",
    title: "Badge",
    variants: [
      { id: "badge-default", title: "Default", to: COMPONENT_PAGES.unused },
    ],
  },
  checklist: {
    id: "checklist",
    title: "Checklist",
    variants: [
      {
        id: "checklist-default",
        title: "Default",
        to: COMPONENT_PAGES["overlay-tall"],
      },
    ],
  },
  "link-button": { id: "link-button", title: "Link button", variants: [] },
} as const satisfies Record<
  ComponentNavigationIdentity,
  ComponentNavigationDefinition
>;

/** Component-variant rows for one disclosed parent, in authored order. */
export function componentVariantRows(
  identity: ComponentNavigationIdentity,
  depth: number,
): NavigationRows {
  return COMPONENT_NAVIGATION[identity].variants.map((variant) => ({
    key: variant.id,
    depth,
    kind: "variant" as const,
    label: variant.title,
    variantParentKind: "component" as const,
    ...("to" in variant ? { to: variant.to } : {}),
  }));
}
