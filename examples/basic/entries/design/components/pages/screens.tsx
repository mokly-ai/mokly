import { screen } from "@mokly/mokly";

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
  screen({
    id: "design-component-help",
    slug: "help",
    title: "Component without a visible region",
    colorSchemes: ["light"],
    description:
      "An invoked Help hint has no visible bounds, with its visibility prop and real consumer still shown in Props.",
    desktop: <HiddenComponentDesktop />,
    mobile: <HiddenComponentMobile />,
  }),
  screen({
    id: "design-component-variants",
    slug: "variants",
    title: "Saved variant",
    colorSchemes: ["light"],
    description:
      "Disabled selected and Unmodified while another saved variant makes the component Changed; no unavailable comparison is offered.",
    desktop: <SavedVariantDesktop />,
    mobile: <SavedVariantMobile />,
  }),
  screen({
    id: "design-component-comparison",
    slug: "comparison",
    title: "Compare a component",
    colorSchemes: ["light"],
    description:
      "Before and current component canvases for one saved variant; affected screens remain separate from Changes.",
    desktop: <ComponentComparisonDesktop />,
    mobile: <ComponentComparisonMobile />,
  }),
  screen({
    id: "design-component-affected",
    slug: "affected",
    title: "Changed component and affected screens",
    colorSchemes: ["light"],
    description:
      "Only Action is in Changes. Welcome and Details are linked under Affected screens without increasing the Changes count.",
    desktop: <AffectedScreensDesktop />,
    mobile: <AffectedScreensMobile />,
  }),
  screen({
    id: "design-component-toolbar",
    slug: "toolbar",
    title: "Component consuming a component",
    colorSchemes: ["light"],
    description:
      "Toolbar composes the same Action preview and links back to its owning component page.",
    desktop: <ToolbarDesktop />,
    mobile: <ToolbarMobile />,
  }),
];
