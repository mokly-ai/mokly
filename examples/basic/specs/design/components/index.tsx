import { defineScreen } from "@mokly/mokly";

import { componentDesignMetadata } from "../metadata.js";
import { artboards } from "../parts/artboards.js";

import { ComponentPage } from "./parts/component_page.js";

export function ComponentOverviewDesktop() {
  return <ComponentPage state="default" viewport="desktop" />;
}
export function ComponentOverviewMobile() {
  return <ComponentPage state="default" viewport="mobile" />;
}

/** Canonical component page followed by linked, bounded groups of owning screens. */
export const overviewScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "overview",
  title: "Component page",
  colorSchemes: ["light"],
  description:
    "Canonical component page with a compact canvas, saved variants, supplied props, and usage links.",
  ...artboards({
    desktop: <ComponentOverviewDesktop />,
    mobile: <ComponentOverviewMobile />,
  }),
});
