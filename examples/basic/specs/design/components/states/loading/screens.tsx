import { defineScreen } from "@mokly/mokly";

import { componentDesignMetadata } from "../../../metadata.js";
import { ComponentPage } from "../../parts/component_page.js";
import { ScreenPage } from "../../parts/screen_page.js";

export function UsageLoadingDesktop() {
  return <ComponentPage state="usage-loading" viewport="desktop" />;
}

export function UsageLoadingMobile() {
  return <ComponentPage state="usage-loading" viewport="mobile" />;
}

export function InspectionLoadingDesktop() {
  return <ScreenPage state="inspection-loading" viewport="desktop" />;
}

export function InspectionLoadingMobile() {
  return <ScreenPage state="inspection-loading" viewport="mobile" />;
}

export function UsageFailedDesktop() {
  return <ComponentPage state="usage-failed" viewport="desktop" />;
}

export function UsageFailedMobile() {
  return <ComponentPage state="usage-failed" viewport="mobile" />;
}

export const loadingStateDesigns = [
  defineScreen({
    ...componentDesignMetadata,
    slug: "usage-loading",
    title: "Usage loading",
    colorSchemes: ["light"],
    description: "A component page while its usage is being found.",
    desktop: <UsageLoadingDesktop />,
    mobile: <UsageLoadingMobile />,
  }),
  defineScreen({
    ...componentDesignMetadata,
    slug: "inspection-loading",
    title: "Inspection loading",
    colorSchemes: ["light"],
    description:
      "A screen preview waiting before component inspection is available.",
    desktop: <InspectionLoadingDesktop />,
    mobile: <InspectionLoadingMobile />,
  }),
  defineScreen({
    ...componentDesignMetadata,
    slug: "usage-failed",
    title: "Usage failed to load",
    colorSchemes: ["light"],
    description:
      "A component page that could not load usage and offers another attempt.",
    desktop: <UsageFailedDesktop />,
    mobile: <UsageFailedMobile />,
  }),
];
