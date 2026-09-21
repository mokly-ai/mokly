import { screen } from "@mokly/mokly";

import { ComponentPage } from "../parts/component_page.js";
import { ScreenPage } from "../parts/screen_page.js";

export function EmptyUsageDesktop() {
  return <ScreenPage state="empty" viewport="desktop" />;
}
export function EmptyUsageMobile() {
  return <ScreenPage state="empty" viewport="mobile" />;
}
export function UnavailableDesktop() {
  return <ScreenPage state="unavailable" viewport="desktop" />;
}
export function UnavailableMobile() {
  return <ScreenPage state="unavailable" viewport="mobile" />;
}
export function UnusedComponentDesktop() {
  return <ComponentPage state="unused" viewport="desktop" />;
}
export function UnusedComponentMobile() {
  return <ComponentPage state="unused" viewport="mobile" />;
}
export function RemovedVariantDesktop() {
  return <ComponentPage state="removed" viewport="desktop" />;
}
export function RemovedVariantMobile() {
  return <ComponentPage state="removed" viewport="mobile" />;
}
export function RemovedConsumerDesktop() {
  return <ScreenPage state="removed-consumer" viewport="desktop" />;
}
export function RemovedConsumerMobile() {
  return <ScreenPage state="removed-consumer" viewport="mobile" />;
}

export const stateScreens = [
  screen({
    id: "design-component-empty",
    slug: "empty",
    title: "No components in this view",
    colorSchemes: ["light"],
    description:
      "A validated empty usage list, with highlighting disabled and a clear zero count.",
    desktop: <EmptyUsageDesktop />,
    mobile: <EmptyUsageMobile />,
  }),
  screen({
    id: "design-component-unavailable",
    slug: "unavailable",
    title: "Inspection unavailable",
    colorSchemes: ["light"],
    description:
      "Missing inspection metadata is not presented as an empty component list.",
    desktop: <UnavailableDesktop />,
    mobile: <UnavailableMobile />,
  }),
  screen({
    id: "design-component-unused",
    slug: "unused",
    title: "Component with no consumers",
    colorSchemes: ["light"],
    description:
      "A component with a saved preview and an explicit empty Used by list.",
    desktop: <UnusedComponentDesktop />,
    mobile: <UnusedComponentMobile />,
  }),
  screen({
    id: "design-component-removed",
    slug: "removed",
    title: "Removed variant and former consumer",
    colorSchemes: ["light"],
    description:
      "The removed Compact variant retains its Before canvas and links a removed affected screen to its previous version.",
    desktop: <RemovedVariantDesktop />,
    mobile: <RemovedVariantMobile />,
  }),
  screen({
    id: "design-component-removed-consumer",
    slug: "removed-consumer",
    title: "Retained removed screen",
    colorSchemes: ["light"],
    description:
      "The former Farewell consumer remains reachable from Action's affected list and opens its previous version.",
    desktop: <RemovedConsumerDesktop />,
    mobile: <RemovedConsumerMobile />,
  }),
];
