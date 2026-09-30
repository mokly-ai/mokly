import { screen } from "@mokly/mokly";

import { ControlsPage } from "../parts/page.js";

export function ReadonlyControlsDesktop() {
  return <ControlsPage state="readonly" viewport="desktop" />;
}
export function ReadonlyControlsMobile() {
  return <ControlsPage state="readonly" viewport="mobile" />;
}
export function ReadonlyVariantControlsDesktop() {
  return <ControlsPage state="readonly-variant" viewport="desktop" />;
}
export function ReadonlyVariantControlsMobile() {
  return <ControlsPage state="readonly-variant" viewport="mobile" />;
}

export const publishedScreens = [
  screen({
    id: "design-component-controls-readonly",
    title: "Published saved props",
    description:
      "Published catalogues show saved values and explain how to edit locally.",
    colorSchemes: ["light"],
    desktop: <ReadonlyControlsDesktop />,
    mobile: <ReadonlyControlsMobile />,
  }),
  screen({
    id: "design-component-controls-readonly-variant",
    title: "Published saved variant",
    description:
      "Variant selection remains available while both published states stay read-only.",
    colorSchemes: ["light"],
    desktop: <ReadonlyVariantControlsDesktop />,
    mobile: <ReadonlyVariantControlsMobile />,
  }),
];
