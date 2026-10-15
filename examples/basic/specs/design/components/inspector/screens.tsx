import { defineScreen } from "@mokly/mokly";

import { componentDesignMetadata } from "../../metadata.js";
import { artboards } from "../../parts/artboards.js";
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

export const inspectorClosedScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "inspector-closed",
  title: "Component inspector closed",
  description:
    "The canvas stays visible with every inspector icon unselected. Open any icon to inspect the component.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <ClosedComponentDesktop />,
    mobile: <ClosedComponentMobile />,
  }),
});
export const screenInspectorClosedScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "screen-inspector-closed",
  title: "Screen inspector closed",
  description:
    "The same icon strip closes beneath a consuming screen, without a selected panel.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <ClosedScreenDesktop />,
    mobile: <ClosedScreenMobile />,
  }),
});
