import { screen } from "@mokly/mokly";

import { ControlsPage } from "../parts/page.js";

export function PendingControlsDesktop() {
  return <ControlsPage state="pending" viewport="desktop" />;
}
export function PendingControlsMobile() {
  return <ControlsPage state="pending" viewport="mobile" />;
}
export function InvalidControlsDesktop() {
  return <ControlsPage state="invalid" viewport="desktop" />;
}
export function InvalidControlsMobile() {
  return <ControlsPage state="invalid" viewport="mobile" />;
}
export function ErrorControlsDesktop() {
  return <ControlsPage state="error" viewport="desktop" />;
}
export function ErrorControlsMobile() {
  return <ControlsPage state="error" viewport="mobile" />;
}
export function ComparisonControlsDesktop() {
  return <ControlsPage state="comparison" viewport="desktop" />;
}
export function ComparisonControlsMobile() {
  return <ControlsPage state="comparison" viewport="mobile" />;
}

export const statesScreens = [
  screen({
    id: "design-component-controls-pending",
    title: "Updating preview",
    description:
      "The last valid preview stays visible while a newer edit renders.",
    colorSchemes: ["light"],
    desktop: <PendingControlsDesktop />,
    mobile: <PendingControlsMobile />,
  }),
  screen({
    id: "design-component-controls-invalid",
    title: "Invalid prop value",
    description:
      "An inline number error keeps the last valid preview and preserves the entered value.",
    colorSchemes: ["light"],
    desktop: <InvalidControlsDesktop />,
    mobile: <InvalidControlsMobile />,
  }),
  screen({
    id: "design-component-controls-error",
    title: "Render failed",
    description:
      "A failed render keeps edits and the last working preview, with retry and reset available.",
    colorSchemes: ["light"],
    desktop: <ErrorControlsDesktop />,
    mobile: <ErrorControlsMobile />,
  }),
  screen({
    id: "design-component-controls-comparison",
    title: "Controls during comparison",
    description:
      "Saved props remain readable in comparison; Current is required before editing.",
    colorSchemes: ["light"],
    desktop: <ComparisonControlsDesktop />,
    mobile: <ComparisonControlsMobile />,
  }),
];
