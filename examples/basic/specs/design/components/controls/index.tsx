import { defineScreen } from "@mokly/mokly";

import { controlsDesignMetadata } from "../../metadata.js";

import { ControlsPage } from "./parts/page.js";

export function ControlsOverviewDesktop() {
  return <ControlsPage state="default" viewport="desktop" />;
}
export function ControlsOverviewMobile() {
  return <ControlsPage state="default" viewport="mobile" />;
}

/** Canonical controls design followed by bounded galleries of authored outcomes. */
export const controlsDesign = [
  defineScreen({
    ...controlsDesignMetadata,
    slug: "controls",
    title: "Component prop controls",
    description:
      "Default saved values with text, boolean, number, select, and optional controls beside the component preview.",
    colorSchemes: ["light"],
    desktop: <ControlsOverviewDesktop />,
    mobile: <ControlsOverviewMobile />,
  }),
];
