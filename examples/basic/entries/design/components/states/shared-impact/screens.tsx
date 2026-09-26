import { folder, screen } from "@mokly/mokly";

import { ComponentPage } from "../../parts/component_page.js";

export function SharedImpactDesktop() {
  return <ComponentPage state="shared-impact" viewport="desktop" />;
}

export function SharedImpactMobile() {
  return <ComponentPage state="shared-impact" viewport="mobile" />;
}

export const sharedImpactDesigns = folder({
  title: "Shared impact",
  children: [
    screen({
      id: "design-component-shared-impact",
      title: "Component with shared files",
      colorSchemes: ["light"],
      description:
        "An unchanged Action component opened from All shows changed shared files in Details without a Changes entry.",
      desktop: <SharedImpactDesktop />,
      mobile: <SharedImpactMobile />,
    }),
  ],
});
