import { screen } from "@mokly/mokly";

import { ComponentPage } from "../parts/component_page.js";
import { ScreenPage } from "../parts/screen_page.js";

export function ClosedComponentDesktop() {
  return <ComponentPage state="closed" viewport="desktop" />;
}
export function ClosedComponentMobile() {
  return <ComponentPage state="closed" viewport="mobile" />;
}
export function ClosedScreenDesktop() {
  return <ScreenPage state="closed" viewport="desktop" />;
}
export function ClosedScreenMobile() {
  return <ScreenPage state="closed" viewport="mobile" />;
}

export const inspectorScreens = [
  screen({
    id: "design-component-inspector-closed",
    title: "Component inspector closed",
    description:
      "The canvas stays visible with every inspector icon unselected. Open any icon to inspect the component.",
    colorSchemes: ["light"],
    desktop: <ClosedComponentDesktop />,
    mobile: <ClosedComponentMobile />,
  }),
  screen({
    id: "design-component-screen-inspector-closed",
    title: "Screen inspector closed",
    description:
      "The same icon strip closes beneath a consuming screen, without a selected panel.",
    colorSchemes: ["light"],
    desktop: <ClosedScreenDesktop />,
    mobile: <ClosedScreenMobile />,
  }),
];
