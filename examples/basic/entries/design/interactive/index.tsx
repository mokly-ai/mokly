import { collection, screen } from "@mokly/mokly";

import { componentStyleDependencies } from "../components/parts/styles.js";

import { modeScreens } from "./modes/screens.js";
import { PreviewModeScreen } from "./parts/preview_screen.js";
import { workspaceScreens } from "./workspace/screens.js";

const INTERACTIVE_DOCS = [
  "docs/protocol/mokly-interactive-views-design.md",
  "docs/protocol/mokly-interactive-views.md",
];

export function InteractiveOverviewDesktop() {
  return <PreviewModeScreen state="live" viewport="desktop" />;
}
export function InteractiveOverviewMobile() {
  return <PreviewModeScreen state="live" viewport="mobile" />;
}

/** Canonical Live screen followed by linked, bounded galleries of its states. */
export const interactiveDesign = collection({
  id: "design-interactive",
  segment: "interactive",
  title: "Static and Live",
  description:
    "One preview toolbar control chooses between the generated screen and the same screen running in the browser, with the states each choice reaches.",
  relatedDocs: INTERACTIVE_DOCS,
  children: [
    screen({
      id: "design-interactive-overview",
      slug: "overview",
      title: "Live preview",
      colorSchemes: ["light"],
      description:
        "A selected screen with Live chosen: the artboard, device frames and inspector are unchanged, and only the toolbar records the choice.",
      desktop: <InteractiveOverviewDesktop />,
      mobile: <InteractiveOverviewMobile />,
    }),
    collection({
      id: "design-interactive-modes",
      segment: "modes",
      title: "Preview states",
      description:
        "Static selected, the wait while a live preview is prepared, and a view that cannot offer one.",
      children: modeScreens,
    }),
    collection({
      id: "design-interactive-workspace",
      segment: "workspace",
      title: "Component workspace",
      description:
        "A saved component example in Live, and the same workspace in a catalogue with no live preview.",
      dependencies: componentStyleDependencies,
      relatedDocs: INTERACTIVE_DOCS,
      children: workspaceScreens,
    }),
  ],
});
