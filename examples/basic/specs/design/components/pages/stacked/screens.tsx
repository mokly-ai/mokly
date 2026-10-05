import { defineScreen } from "@mokly/mokly";

import { componentDesignMetadata } from "../../../metadata.js";
import { ComponentPage } from "../../parts/component_page.js";

export function ComponentOverlayDesktop() {
  return <ComponentPage state="overlay" viewport="desktop" />;
}
export function ComponentOverlayMobile() {
  return <ComponentPage state="overlay" viewport="mobile" />;
}
export function ComponentDifferenceDesktop() {
  return <ComponentPage state="difference" viewport="desktop" />;
}
export function ComponentDifferenceMobile() {
  return <ComponentPage state="difference" viewport="mobile" />;
}
export function TallComponentOverlayDesktop() {
  return <ComponentPage state="overlay-tall" viewport="desktop" />;
}
export function TallComponentOverlayMobile() {
  return <ComponentPage state="overlay-tall" viewport="mobile" />;
}

/** Overlay and Difference hold a saved variant's versions in one bordered frame. */
export const stackedDesigns = [
  defineScreen({
    ...componentDesignMetadata,
    slug: "overlay",
    title: "Overlay a component",
    colorSchemes: ["light"],
    description:
      "Action's Default variant in Overlay, with both versions in one bordered frame and the current version on top at half strength.",
    rationale:
      "Both versions share one frame, so the comparison reads as one component: the current version sits over the previous one, and both always share one scroll position.",
    desktop: <ComponentOverlayDesktop />,
    mobile: <ComponentOverlayMobile />,
  }),
  defineScreen({
    ...componentDesignMetadata,
    slug: "difference",
    title: "Component difference",
    colorSchemes: ["light"],
    description:
      "Action's Default variant in Difference, with the current version blended over the opaque previous version inside one bordered frame.",
    rationale:
      "Blending over an opaque previous version turns everything the two versions share dark, so only the change stands out, and both versions always share one scroll position.",
    desktop: <ComponentDifferenceDesktop />,
    mobile: <ComponentDifferenceMobile />,
  }),
  defineScreen({
    ...componentDesignMetadata,
    slug: "overlay-tall",
    title: "Overlay on a tall component",
    colorSchemes: ["light"],
    description:
      "A Checklist taller than its frame in Overlay, part-way down the one bordered frame both versions share.",
    rationale:
      "A component taller than its frame scrolls inside the one frame both versions share, so the two versions always sit at the same scroll position wherever the reader stops.",
    desktop: <TallComponentOverlayDesktop />,
    mobile: <TallComponentOverlayMobile />,
  }),
];
