import { folder, screen } from "@mokly/mokly";

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
export const interactiveDesign = folder({
  title: "Static and Live",
  relatedDocs: INTERACTIVE_DOCS,
  children: [
    screen({
      id: "design-interactive-overview",
      title: "Live preview",
      colorSchemes: ["light"],
      description:
        "A selected screen with Live chosen: the artboard, device frames and inspector are unchanged, and only the toolbar records the choice.",
      desktop: <InteractiveOverviewDesktop />,
      mobile: <InteractiveOverviewMobile />,
    }),
    folder({
      title: "Preview states",
      children: modeScreens,
    }),
    folder({
      title: "Component workspace",
      dependencies: componentStyleDependencies,
      relatedDocs: INTERACTIVE_DOCS,
      children: workspaceScreens,
    }),
  ],
});
