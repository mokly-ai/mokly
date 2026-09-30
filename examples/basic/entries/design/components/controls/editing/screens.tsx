import { screen } from "@mokly/mokly";

import { ControlsPage } from "../parts/page.js";

export function EditedControlsDesktop() {
  return <ControlsPage state="edited" viewport="desktop" />;
}
export function EditedControlsMobile() {
  return <ControlsPage state="edited" viewport="mobile" />;
}
export function UnsetControlsDesktop() {
  return <ControlsPage state="unset" viewport="desktop" />;
}
export function UnsetControlsMobile() {
  return <ControlsPage state="unset" viewport="mobile" />;
}
export function VariantControlsDesktop() {
  return <ControlsPage state="variant" viewport="desktop" />;
}
export function VariantControlsMobile() {
  return <ControlsPage state="variant" viewport="mobile" />;
}
export function ResetControlsDesktop() {
  return <ControlsPage state="reset" viewport="desktop" />;
}
export function ResetControlsMobile() {
  return <ControlsPage state="reset" viewport="mobile" />;
}

export const editingScreens = [
  screen({
    id: "design-component-controls-edited",
    title: "Edited props",
    description:
      "Edited values update the component example while leaving the saved Default variant intact.",
    colorSchemes: ["light"],
    desktop: <EditedControlsDesktop />,
    mobile: <EditedControlsMobile />,
  }),
  screen({
    id: "design-component-controls-unset",
    title: "Optional prop unset",
    description:
      "The hint prop is absent, distinct from an explicitly empty hint.",
    colorSchemes: ["light"],
    desktop: <UnsetControlsDesktop />,
    mobile: <UnsetControlsMobile />,
  }),
  screen({
    id: "design-component-controls-variant",
    title: "Switch saved variant",
    description:
      "Choosing Disabled replaces temporary edits with its complete saved preset.",
    colorSchemes: ["light"],
    desktop: <VariantControlsDesktop />,
    mobile: <VariantControlsMobile />,
  }),
  screen({
    id: "design-component-controls-reset",
    title: "Reset saved values",
    description:
      "Reset restores the selected preset and clears the Edited indicator.",
    colorSchemes: ["light"],
    desktop: <ResetControlsDesktop />,
    mobile: <ResetControlsMobile />,
  }),
];
