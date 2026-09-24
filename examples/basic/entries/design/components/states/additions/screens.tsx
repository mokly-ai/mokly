import { folder, screen } from "@mokly/mokly";

import { ComponentPage } from "../../parts/component_page.js";

export function AddedComponentDesktop() {
  return <ComponentPage state="added" viewport="desktop" />;
}

export function AddedComponentMobile() {
  return <ComponentPage state="added" viewport="mobile" />;
}

export const additionDesigns = folder({
  segment: "additions",
  title: "Additions",
  children: [
    screen({
      id: "design-component-added",
      slug: "added",
      title: "Added component",
      colorSchemes: ["light"],
      description:
        "A newly added Badge component with one Changes entry and its current saved preview.",
      desktop: <AddedComponentDesktop />,
      mobile: <AddedComponentMobile />,
    }),
  ],
});
