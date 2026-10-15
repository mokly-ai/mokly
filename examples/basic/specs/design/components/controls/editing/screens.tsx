import { defineScreen } from "@mokly/mokly";

import { controlsDesignMetadata } from "../../../metadata.js";
import { artboards } from "../../../parts/artboards.js";
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

export const editedScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "edited",
  title: "Edited props",
  description:
    "Edited values update the component example while leaving the saved Default variant intact.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <EditedControlsDesktop />,
    mobile: <EditedControlsMobile />,
  }),
});
export const unsetScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "unset",
  title: "Optional prop unset",
  description:
    "The hint prop is absent, distinct from an explicitly empty hint.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <UnsetControlsDesktop />,
    mobile: <UnsetControlsMobile />,
  }),
});
export const variantScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "variant",
  title: "Switch saved variant",
  description:
    "Choosing Disabled replaces temporary edits with its complete saved preset.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <VariantControlsDesktop />,
    mobile: <VariantControlsMobile />,
  }),
});
export const resetScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "reset",
  title: "Reset saved values",
  description:
    "Reset restores the selected preset and clears the Edited indicator.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <ResetControlsDesktop />,
    mobile: <ResetControlsMobile />,
  }),
});
