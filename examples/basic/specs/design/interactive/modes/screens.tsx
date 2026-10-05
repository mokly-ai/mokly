import { defineScreen } from "@mokly/mokly";

import { PreviewModeScreen } from "../parts/preview_screen.js";

export function StaticPreviewDesktop() {
  return <PreviewModeScreen state="static" viewport="desktop" />;
}
export function StaticPreviewMobile() {
  return <PreviewModeScreen state="static" viewport="mobile" />;
}
export function PreparingPreviewDesktop() {
  return <PreviewModeScreen state="preparing" viewport="desktop" />;
}
export function PreparingPreviewMobile() {
  return <PreviewModeScreen state="preparing" viewport="mobile" />;
}
export function UnavailablePreviewDesktop() {
  return <PreviewModeScreen state="unavailable" viewport="desktop" />;
}
export function UnavailablePreviewMobile() {
  return <PreviewModeScreen state="unavailable" viewport="mobile" />;
}

/** The preview states one selected screen reaches beside its Live view. */
export const modeScreens = [
  defineScreen({
    dependencies: [
      "examples/basic/generated/design-stage.css",
      "examples/basic/generated/design.css",
    ],
    relatedDocs: ["docs/protocol/mokly-interactive-views-design.md"],
    slug: "static",
    title: "Static preview",
    colorSchemes: ["light"],
    description:
      "The same screen with Static selected; choosing Live prepares the preview.",
    desktop: <StaticPreviewDesktop />,
    mobile: <StaticPreviewMobile />,
  }),
  defineScreen({
    dependencies: [
      "examples/basic/generated/design-stage.css",
      "examples/basic/generated/design.css",
    ],
    relatedDocs: ["docs/protocol/mokly-interactive-views-design.md"],
    slug: "preparing",
    title: "Preparing the live preview",
    colorSchemes: ["light"],
    description:
      "Live is selected while the preview is being prepared, and Static stays selectable.",
    desktop: <PreparingPreviewDesktop />,
    mobile: <PreparingPreviewMobile />,
  }),
  defineScreen({
    dependencies: [
      "examples/basic/generated/design-stage.css",
      "examples/basic/generated/design.css",
    ],
    relatedDocs: ["docs/protocol/mokly-interactive-views-design.md"],
    slug: "unavailable",
    title: "Live unavailable",
    colorSchemes: ["light"],
    description:
      "Live cannot run for this view, so Static stays selected and Live is described as unavailable.",
    desktop: <UnavailablePreviewDesktop />,
    mobile: <UnavailablePreviewMobile />,
  }),
];
