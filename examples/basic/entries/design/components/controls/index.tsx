import { collection, screen } from "@mokly/mokly";

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
export const controlsDesign = collection({
  id: "design-component-controls-design",
  segment: "controls",
  title: "Prop controls",
  description:
    "Edit scalar props, switch complete saved presets, and recover from invalid values or rendering failures. Native fields are interactive; linked artboards show the authored preview outcomes. Live preview rendering is a later implementation milestone.",
  dependencies: [
    ...componentStyleDependencies,
    "examples/basic/design-component-controls.css",
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
    collection({
      id: "design-component-controls-editing",
      segment: "editing",
      title: "Editing and saved variants",
      description:
        "Edited props, an unset optional value, switching variants, and resetting edits.",
      children: editingScreens,
    }),
    collection({
      id: "design-component-controls-states",
      segment: "states",
      title: "Rendering and comparison",
      description:
        "Loading, validation, failure and retry, and comparison boundaries.",
      children: statesScreens,
    }),
    collection({
      id: "design-component-controls-published",
      segment: "published",
      title: "Published catalogue",
      description:
        "Saved variants remain selectable while their props stay read-only.",
      children: publishedScreens,
    }),
  ],
});
