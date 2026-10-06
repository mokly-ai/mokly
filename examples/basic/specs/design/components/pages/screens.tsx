import { defineScreen } from "@mokly/mokly";

import { componentDesignMetadata } from "../../metadata.js";
import { ComponentPage } from "../parts/component_page.js";

export function SavedVariantDesktop() {
  return <ComponentPage state="disabled" viewport="desktop" />;
}
export function SavedVariantMobile() {
  return <ComponentPage state="disabled" viewport="mobile" />;
}
export function ComponentComparisonDesktop() {
  return <ComponentPage state="comparison" viewport="desktop" />;
}
export function ComponentComparisonMobile() {
  return <ComponentPage state="comparison" viewport="mobile" />;
}
export function AffectedScreensDesktop() {
  return <ComponentPage state="affected" viewport="desktop" />;
}
export function AffectedScreensMobile() {
  return <ComponentPage state="affected" viewport="mobile" />;
}
export function ToolbarDesktop() {
  return <ComponentPage state="toolbar" viewport="desktop" />;
}
export function ToolbarMobile() {
  return <ComponentPage state="toolbar" viewport="mobile" />;
}
export function HiddenComponentDesktop() {
  return <ComponentPage state="hidden" viewport="desktop" />;
}
export function HiddenComponentMobile() {
  return <ComponentPage state="hidden" viewport="mobile" />;
}

export const pageScreens = [
  defineScreen({
    ...componentDesignMetadata,
    slug: "help",
    title: "Component without a visible region",
    colorSchemes: ["light"],
    description:
      "An invoked Help hint has no visible bounds, with its visibility prop and real consumer still shown in Props.",
    desktop: <HiddenComponentDesktop />,
    mobile: <HiddenComponentMobile />,
  }),
  defineScreen({
    ...componentDesignMetadata,
    slug: "variants",
    title: "Saved variant",
    colorSchemes: ["light"],
    description:
      "Disabled selected and Unmodified while another saved variant makes the component Changed; no unavailable comparison is offered.",
    desktop: <SavedVariantDesktop />,
    mobile: <SavedVariantMobile />,
  }),
  defineScreen({
    ...componentDesignMetadata,
    slug: "comparison",
    title: "Compare a component",
    colorSchemes: ["light"],
    description:
      "Before and current component canvases for one saved variant; affected screens remain separate from Changes.",
    desktop: <ComponentComparisonDesktop />,
    mobile: <ComponentComparisonMobile />,
  }),
  defineScreen({
    ...componentDesignMetadata,
    slug: "affected",
    title: "Changed component and affected screens",
    colorSchemes: ["light"],
    description:
      "Only Action is in Changes. Welcome and Details are linked under Affected screens without increasing the Changes count.",
    desktop: <AffectedScreensDesktop />,
    mobile: <AffectedScreensMobile />,
  }),
  defineScreen({
    ...componentDesignMetadata,
    slug: "toolbar",
    title: "Component consuming a component",
    colorSchemes: ["light"],
    description:
      "Toolbar composes the same Action preview and links back to its owning component page.",
    desktop: <ToolbarDesktop />,
    mobile: <ToolbarMobile />,
  }),
];
