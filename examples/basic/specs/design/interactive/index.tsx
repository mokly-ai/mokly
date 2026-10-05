import { defineScreen } from "@mokly/mokly";

import { PreviewModeScreen } from "./parts/preview_screen.js";

export function InteractiveOverviewDesktop() {
  return <PreviewModeScreen state="live" viewport="desktop" />;
}
export function InteractiveOverviewMobile() {
  return <PreviewModeScreen state="live" viewport="mobile" />;
}

export const interactiveOverview = defineScreen({
  slug: "overview",
  title: "Live preview",
  colorSchemes: ["light"],
  dependencies: [
    "examples/basic/generated/design-stage.css",
    "examples/basic/generated/design.css",
  ],
  relatedDocs: [
    "docs/protocol/mokly-interactive-views-design.md",
    "docs/protocol/mokly-interactive-views.md",
  ],
  description: "A selected screen with Live chosen in the preview toolbar.",
  desktop: <InteractiveOverviewDesktop />,
  mobile: <InteractiveOverviewMobile />,
});
