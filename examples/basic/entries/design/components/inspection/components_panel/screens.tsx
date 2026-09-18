import type { ReactNode } from "react";

import { collection, screen } from "@mokly/mokly";

import {
  COMPONENT_PANEL_VARIANTS,
  type ComponentDesignDestination,
} from "../../parts/destinations.js";
import { ScreenPage } from "../../parts/screen_page.js";
import {
  componentPanelVariantStyleDependencies,
  componentStyleDependencies,
} from "../../parts/styles.js";

import { panelSummary } from "./model.js";
import { OwnershipOutline, RenderTree } from "./tree_layouts.js";
import { ComponentIndex, ComponentLedger } from "./type_layouts.js";

type Variant = keyof typeof COMPONENT_PANEL_VARIANTS;

function VariantPage({
  content,
  design,
  viewport,
}: {
  content: ReactNode;
  design: ComponentDesignDestination;
  viewport: "desktop" | "mobile";
}) {
  return (
    <ScreenPage
      componentPanel={content}
      componentSummary={panelSummary}
      design={design}
      inspectorInitial="components"
      state="details"
      viewport={viewport}
    />
  );
}

export function RenderTreeDesktop() {
  return (
    <VariantPage
      content={<RenderTree />}
      design={COMPONENT_PANEL_VARIANTS.tree}
      viewport="desktop"
    />
  );
}

export function RenderTreeMobile() {
  return (
    <VariantPage
      content={<RenderTree />}
      design={COMPONENT_PANEL_VARIANTS.tree}
      viewport="mobile"
    />
  );
}

export function OwnershipOutlineDesktop() {
  return (
    <VariantPage
      content={<OwnershipOutline />}
      design={COMPONENT_PANEL_VARIANTS.outline}
      viewport="desktop"
    />
  );
}

export function OwnershipOutlineMobile() {
  return (
    <VariantPage
      content={<OwnershipOutline />}
      design={COMPONENT_PANEL_VARIANTS.outline}
      viewport="mobile"
    />
  );
}

export function ComponentIndexDesktop() {
  return (
    <VariantPage
      content={<ComponentIndex />}
      design={COMPONENT_PANEL_VARIANTS.groups}
      viewport="desktop"
    />
  );
}

export function ComponentIndexMobile() {
  return (
    <VariantPage
      content={<ComponentIndex />}
      design={COMPONENT_PANEL_VARIANTS.groups}
      viewport="mobile"
    />
  );
}

export function ComponentLedgerDesktop() {
  return (
    <VariantPage
      content={<ComponentLedger />}
      design={COMPONENT_PANEL_VARIANTS.ledger}
      viewport="desktop"
    />
  );
}

export function ComponentLedgerMobile() {
  return (
    <VariantPage
      content={<ComponentLedger />}
      design={COMPONENT_PANEL_VARIANTS.ledger}
      viewport="mobile"
    />
  );
}

const variants = {
  tree: {
    title: "Components panel · render tree",
    description:
      "One row per instance at its real owner depth, with nested instances behind a disclosure and repeated-instance ordinals.",
    desktop: <RenderTreeDesktop />,
    mobile: <RenderTreeMobile />,
  },
  outline: {
    title: "Components panel · ownership outline",
    description:
      "An expanded ownership outline with component totals and every nested instance visible.",
    desktop: <OwnershipOutlineDesktop />,
    mobile: <OwnershipOutlineMobile />,
  },
  groups: {
    title: "Components panel · component index",
    description:
      "Unique instances grouped by component, with their owners and containment visible as metadata.",
    desktop: <ComponentIndexDesktop />,
    mobile: <ComponentIndexMobile />,
  },
  ledger: {
    title: "Components panel · component ledger",
    description:
      "An always-visible component, instance, and owner ledger without nested disclosures.",
    desktop: <ComponentLedgerDesktop />,
    mobile: <ComponentLedgerMobile />,
  },
} as const satisfies Record<
  Variant,
  {
    title: string;
    description: string;
    desktop: ReactNode;
    mobile: ReactNode;
  }
>;

export const componentsPanelVariants = collection({
  id: "design-component-components-panel",
  segment: "components-panel",
  title: "Components panel variants",
  description:
    "Four candidate information architectures for a screen inspector's Components panel.",
  dependencies: [
    ...componentStyleDependencies,
    ...componentPanelVariantStyleDependencies,
  ],
  children: (Object.keys(variants) as Variant[]).map((variant) =>
    screen({
      id: COMPONENT_PANEL_VARIANTS[variant],
      slug: variant,
      title: variants[variant].title,
      colorSchemes: ["light"],
      description: variants[variant].description,
      desktop: variants[variant].desktop,
      mobile: variants[variant].mobile,
    }),
  ),
});
