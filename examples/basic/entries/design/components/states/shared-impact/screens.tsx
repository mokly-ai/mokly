import { folder, screen } from "@mokly/mokly";

import { ComponentPage } from "../../parts/component_page.js";
import { ScreenPage } from "../../parts/screen_page.js";

export function SharedImpactDesktop() {
  return <ComponentPage state="shared-impact" viewport="desktop" />;
}

export function SharedImpactMobile() {
  return <ComponentPage state="shared-impact" viewport="mobile" />;
}

export function StyleChangedDesktop() {
  return <ComponentPage state="style-changed" viewport="desktop" />;
}

export function StyleChangedMobile() {
  return <ComponentPage state="style-changed" viewport="mobile" />;
}

export function StyleOutsideDesktop() {
  return <ScreenPage state="style-outside" viewport="desktop" />;
}

export function StyleOutsideMobile() {
  return <ScreenPage state="style-outside" viewport="mobile" />;
}

/** Stylesheet changes that change a component, reach past it, or reach nothing. */
export const sharedImpactDesigns = folder({
  title: "Stylesheet evidence",
  children: [
    screen({
      id: "design-component-style-changed",
      title: "Component with changed styles",
      colorSchemes: ["light"],
      description:
        "A changed rule in Action's stylesheet styles only Action's own output, so Action and its saved variants are in Changes, and Welcome and Details appear under Affected screens without rows of their own.",
      rationale:
        "The rule matches Action on its own saved pages, so Action changes. On Welcome and Details it matches only inside Action, so those screens stay out of Changes. Details names the stylesheet once and, under it, the changed styles that apply to the component.",
      desktop: <StyleChangedDesktop />,
      mobile: <StyleChangedMobile />,
    }),
    screen({
      id: "design-component-style-outside",
      title: "Styles outside a changed component",
      colorSchemes: ["light"],
      description:
        "The rule that changes Action also styles Welcome's own Not now link, which is not part of Action, so Welcome has its own Changes row beside Action.",
      rationale:
        "Details names the stylesheet once and, under it, only the styles that also apply outside the changed components. Changed components used here links to Action's own page.",
      desktop: <StyleOutsideDesktop />,
      mobile: <StyleOutsideMobile />,
    }),
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
