import { defineScreen } from "@mokly/mokly";

import { componentDesignMetadata } from "../../../metadata.js";
import { artboards } from "../../../parts/artboards.js";
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

export function AffectedScreenDesktop() {
  return <ScreenPage state="affected-screen" viewport="desktop" />;
}

export function AffectedScreenMobile() {
  return <ScreenPage state="affected-screen" viewport="mobile" />;
}

/** Stylesheet changes that change a component, reach past it, or reach nothing. */
export const styleChangedScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "style-changed",
  title: "Component with changed styles",
  colorSchemes: ["light"],
  description:
    "A changed rule in Action's stylesheet styles only Action's own output, and a markup change shows only where Welcome and Details use Action. Action and its saved variants are in Changes, and Welcome and Details appear under Affected screens without rows of their own.",
  rationale:
    "The rule matches Action on its own saved pages, so Action changes. On Welcome and Details it matches only inside Action, so those screens stay out of Changes. No saved variant shows the markup change, so Details says that the rendered content changed where Action is used, and the Default caption still names only the styles. Details then names the stylesheet once and, under it, the changed styles that apply to the component.",
  ...artboards({
    desktop: <StyleChangedDesktop />,
    mobile: <StyleChangedMobile />,
  }),
});
export const styleOutsideScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "style-outside",
  title: "Styles outside a changed component",
  colorSchemes: ["light"],
  description:
    "The rule that changes Action also styles Welcome's own Not now link, which is not part of Action, so Welcome has its own Changes row beside Action.",
  rationale:
    "Details names the stylesheet once and, under it, only the styles that also apply outside the changed components. The Changed component line links to Action's own page.",
  ...artboards({
    desktop: <StyleOutsideDesktop />,
    mobile: <StyleOutsideMobile />,
  }),
});
export const affectedScreenScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "affected-screen",
  title: "Screen affected by a changed component",
  colorSchemes: ["light"],
  description:
    "Welcome opened from Action's Affected screens in Component with changed styles, which opens its side-by-side comparison. Welcome has no Changes row of its own, yet the Action it uses renders differently, so each view's heading names the changed components and Details explain the shared component change.",
  rationale:
    "Welcome's own content is unchanged, so its views stay unchanged, it reads Unmodified, and All shows it outside Changes. Changed components still change how it renders, so the band offers its comparison, and each shown view reads Components this screen uses changed over its two versions. A component in the same position reads Components this variant uses changed. Details list the changed stylesheet with the styles that apply to Welcome, link Action, and end with the sentence that explains the change in place of the no-changes line.",
  ...artboards({
    desktop: <AffectedScreenDesktop />,
    mobile: <AffectedScreenMobile />,
  }),
});
export const sharedImpactScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "shared-impact",
  title: "Component with excluded styles",
  colorSchemes: ["light"],
  description:
    "An unchanged Action component opened from All shows an examined stylesheet whose changed rules do not apply to its selected variant.",
  ...artboards({
    desktop: <SharedImpactDesktop />,
    mobile: <SharedImpactMobile />,
  }),
});
