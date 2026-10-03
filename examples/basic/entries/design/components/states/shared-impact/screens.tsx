import { folder, screen } from "@mokly/mokly";

import { ComponentPage } from "../../parts/component_page.js";

export function SharedImpactDesktop() {
  return <ComponentPage state="shared-impact" viewport="desktop" />;
}

export function SharedImpactMobile() {
  return <ComponentPage state="shared-impact" viewport="mobile" />;
}

export const sharedImpactDesigns = folder({
  title: "Stylesheet evidence",
  children: [
    screen({
      id: "design-component-shared-impact",
      title: "Component with excluded styles",
      colorSchemes: ["light"],
      description:
        "An unchanged Action component opened from All shows an examined stylesheet whose changed rules do not apply to its selected variant.",
      desktop: <SharedImpactDesktop />,
      mobile: <SharedImpactMobile />,
    }),
  ],
});
