import { folder, screen } from "@mokly/mokly";

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

export const loadingStateDesigns = folder({
  title: "Loading and recovery",
  children: [
    screen({
      id: "design-component-usage-loading",
      title: "Usage loading",
      colorSchemes: ["light"],
      description: "A component page while its usage is being found.",
      desktop: <UsageLoadingDesktop />,
      mobile: <UsageLoadingMobile />,
    }),
    screen({
      id: "design-component-inspection-loading",
      title: "Inspection loading",
      colorSchemes: ["light"],
      description:
        "A screen preview waiting before component inspection is available.",
      desktop: <InspectionLoadingDesktop />,
      mobile: <InspectionLoadingMobile />,
    }),
    screen({
      id: "design-component-usage-failed",
      title: "Usage failed to load",
      colorSchemes: ["light"],
      description:
        "A component page that could not load usage and offers another attempt.",
      desktop: <UsageFailedDesktop />,
      mobile: <UsageFailedMobile />,
    }),
  ],
});
