import { defineScreen } from "@mokly/mokly";

import { controlsDesignMetadata } from "../../../metadata.js";
import { artboards, artboardStates } from "../../../parts/artboards.js";
import { ControlsPage } from "../parts/page.js";

export function PendingControlsDesktop() {
  return <ControlsPage state="pending" viewport="desktop" />;
}
export function PendingControlsMobile() {
  return <ControlsPage state="pending" viewport="mobile" />;
}
export function PreparingControlsDesktop() {
  return <ControlsPage state="preparing" viewport="desktop" />;
}
export function PreparingControlsMobile() {
  return <ControlsPage state="preparing" viewport="mobile" />;
}
export function PreparingFailedControlsDesktop() {
  return <ControlsPage state="preparing-failed" viewport="desktop" />;
}
export function PreparingFailedControlsMobile() {
  return <ControlsPage state="preparing-failed" viewport="mobile" />;
}
export function InvalidControlsDesktop() {
  return <ControlsPage state="invalid" viewport="desktop" />;
}
export function InvalidControlsMobile() {
  return <ControlsPage state="invalid" viewport="mobile" />;
}
export function ErrorControlsDesktop() {
  return <ControlsPage state="error" viewport="desktop" />;
}
export function ErrorControlsMobile() {
  return <ControlsPage state="error" viewport="mobile" />;
}
export function ComparisonControlsDesktop() {
  return <ControlsPage state="comparison" viewport="desktop" />;
}
export function ComparisonControlsMobile() {
  return <ControlsPage state="comparison" viewport="mobile" />;
}

export const pendingScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "pending",
  title: "Updating preview",
  description:
    "The last valid preview stays visible while a newer edit renders.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <PendingControlsDesktop />,
    mobile: <PendingControlsMobile />,
  }),
});
export const preparingScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "preparing",
  title: "Preparing to edit",
  description:
    "Until the first live descriptor installs, local Serve shows the saved props in read-only fields; a later refetch keeps editing available.",
  colorSchemes: ["light"],
  ...artboardStates(
    {
      state: "preparing",
      title: "Preparing to edit",
      desktop: <PreparingControlsDesktop />,
      mobile: <PreparingControlsMobile />,
    },
    [
      {
        slug: "failed",
        title: "Editing could not start",
        description:
          "The saved props stay visible and read-only; browsing keeps working, and Try again fetches the live descriptor again.",
        desktop: <PreparingFailedControlsDesktop />,
        mobile: <PreparingFailedControlsMobile />,
      },
    ],
  ),
});
export const invalidScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "invalid",
  title: "Invalid prop value",
  description:
    "An inline number error keeps the last valid preview and preserves the entered value.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <InvalidControlsDesktop />,
    mobile: <InvalidControlsMobile />,
  }),
});
export const errorScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "error",
  title: "Render failed",
  description:
    "A failed render keeps edits and the last working preview, with retry and reset available.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <ErrorControlsDesktop />,
    mobile: <ErrorControlsMobile />,
  }),
});
export const comparisonScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "comparison",
  title: "Controls during comparison",
  description:
    "Saved props remain readable in comparison; Current is required before editing.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <ComparisonControlsDesktop />,
    mobile: <ComparisonControlsMobile />,
  }),
});
