import { defineScreen } from "@mokly/mokly";

import { controlsDesignMetadata } from "../../metadata.js";
import { artboardStates } from "../../parts/artboards.js";

import { ControlsPage } from "./parts/page.js";

/**
 * Canonical controls design followed by bounded galleries of authored
 * outcomes. It shows Action's own entry, which the component overview's Edit
 * props opens; its Default state is the saved variant the edit stories use.
 */
export const controlsScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "controls",
  title: "Component prop controls",
  description:
    "Action's own props with text, boolean, number, select, and optional controls beside the component preview.",
  colorSchemes: ["light"],
  ...artboardStates(
    {
      state: "parent",
      title: "Action's own entry",
      desktop: <ControlsPage state="parent" viewport="desktop" />,
      mobile: <ControlsPage state="parent" viewport="mobile" />,
    },
    [
      {
        slug: "default",
        title: "Default saved variant",
        description:
          "Default's saved values in the same controls, opened from the variant bar.",
        desktop: <ControlsPage state="default" viewport="desktop" />,
        mobile: <ControlsPage state="default" viewport="mobile" />,
      },
    ],
  ),
});
