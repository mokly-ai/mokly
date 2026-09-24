import { collection, screen } from "@mokly/mokly";

import { controlsDesign } from "./controls/index.js";
import { inspectionScreens } from "./inspection/screens.js";
import { selectionScreens } from "./inspection/selection/screens.js";
import { inspectorScreens } from "./inspector/screens.js";
import { pageScreens } from "./pages/screens.js";
import { ComponentPage } from "./parts/component_page.js";
import { componentDesignDocs } from "./parts/fixtures.js";
import { additionDesigns } from "./states/additions/screens.js";
import { stateScreens } from "./states/screens.js";

export function ComponentOverviewDesktop() {
  return <ComponentPage state="default" viewport="desktop" />;
}
export function ComponentOverviewMobile() {
  return <ComponentPage state="default" viewport="mobile" />;
}

/** Canonical component page followed by linked, bounded groups of owning screens. */
export const componentDesign = collection({
  id: "design-components",
  segment: "components",
  title: "Component explorer",
  description:
    "Component pages, saved examples, change attribution, and screen inspection.",
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
    collection({
      id: "design-component-inspector",
      segment: "inspector",
      title: "Inspector closed",
      description:
        "Closed component and screen inspectors, with every icon available to open a panel.",
      children: inspectorScreens,
    }),
    controlsDesign,
    collection({
      id: "design-component-pages",
      segment: "pages",
      title: "Pages and comparisons",
      description:
        "Saved variants, component comparisons, and usage relationships.",
      children: pageScreens,
    }),
    collection({
      id: "design-component-inspection",
      segment: "inspection",
      title: "Screen inspection",
      description:
        "Repeated and nested components, highlighting, and independent screen changes.",
      children: [
        ...inspectionScreens,
        collection({
          id: "design-component-selection",
          segment: "selection",
          title: "Selected instances",
          description:
            "Container and hidden instances reached from component usage links.",
          children: selectionScreens,
        }),
      ],
    }),
    collection({
      id: "design-component-states",
      segment: "states",
      title: "Empty and change states",
      description:
        "Empty usage, unavailable inspection, unused components, and retained comparisons.",
      children: [...stateScreens, additionDesigns],
    }),
  ],
});
