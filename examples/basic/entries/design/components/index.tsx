import { folder, screen } from "@mokly/mokly";

import { controlsDesign } from "./controls/index.js";
import { inspectionScreens } from "./inspection/screens.js";
import { selectionScreens } from "./inspection/selection/screens.js";
import { inspectorScreens } from "./inspector/screens.js";
import { pageScreens } from "./pages/screens.js";
import { ComponentPage } from "./parts/component_page.js";
import { componentDesignDocs } from "./parts/fixtures.js";
import { componentStyleDependencies } from "./parts/styles.js";
import { additionDesigns } from "./states/additions/screens.js";
import { stateScreens } from "./states/screens.js";

export function ComponentOverviewDesktop() {
  return <ComponentPage state="default" viewport="desktop" />;
}
export function ComponentOverviewMobile() {
  return <ComponentPage state="default" viewport="mobile" />;
}

/** Canonical component page followed by linked, bounded groups of owning screens. */
export const componentDesign = folder({
  segment: "components",
  title: "Component explorer",
  dependencies: componentStyleDependencies,
  relatedDocs: componentDesignDocs,
  children: [
    screen({
      id: "design-component-overview",
      slug: "overview",
      title: "Component page",
      colorSchemes: ["light"],
      description:
        "Canonical component page with a compact canvas, saved variants, supplied props, and usage links.",
      desktop: <ComponentOverviewDesktop />,
      mobile: <ComponentOverviewMobile />,
    }),
    folder({
      segment: "inspector",
      title: "Inspector closed",
      children: inspectorScreens,
    }),
    controlsDesign,
    folder({
      segment: "pages",
      title: "Pages and comparisons",
      children: pageScreens,
    }),
    folder({
      segment: "inspection",
      title: "Screen inspection",
      children: [
        ...inspectionScreens,
        folder({
          segment: "selection",
          title: "Selected instances",
          children: selectionScreens,
        }),
      ],
    }),
    folder({
      segment: "states",
      title: "Empty and change states",
      children: [...stateScreens, additionDesigns],
    }),
  ],
});
