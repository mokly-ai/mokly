import { folder, screen } from "@mokly/mokly";

import { componentStyleDependencies } from "../parts/styles.js";

import { editingScreens } from "./editing/screens.js";
import { ControlsPage } from "./parts/page.js";
import { publishedScreens } from "./published/screens.js";
import { statesScreens } from "./states/screens.js";

export function ControlsOverviewDesktop() {
  return <ControlsPage state="default" viewport="desktop" />;
}
export function ControlsOverviewMobile() {
  return <ControlsPage state="default" viewport="mobile" />;
}

/** Canonical controls design followed by bounded galleries of authored outcomes. */
export const controlsDesign = folder({
  segment: "controls",
  title: "Prop controls",
  dependencies: [
    ...componentStyleDependencies,
    "examples/basic/generated/design-component-controls.css",
  ],
  relatedDocs: [
    "docs/protocol/mokly-component-controls-design.md",
    "docs/protocol/mokly-component-controls.md",
  ],
  children: [
    screen({
      id: "design-component-controls",
      slug: "overview",
      title: "Component prop controls",
      description:
        "Default saved values with text, boolean, number, select, and optional controls beside the component preview.",
      colorSchemes: ["light"],
      desktop: <ControlsOverviewDesktop />,
      mobile: <ControlsOverviewMobile />,
    }),
    folder({
      segment: "editing",
      title: "Editing and saved variants",
      children: editingScreens,
    }),
    folder({
      segment: "states",
      title: "Rendering and comparison",
      children: statesScreens,
    }),
    folder({
      segment: "published",
      title: "Published catalogue",
      children: publishedScreens,
    }),
  ],
});
