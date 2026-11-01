import { defineScreen } from "@mokly/mokly";

import { componentDesignMetadata } from "../../metadata.js";
import { artboards } from "../../parts/artboards.js";
import { ScreenPage } from "../parts/screen_page.js";

export function ScreenDetailsDesktop() {
  return <ScreenPage state="details" viewport="desktop" />;
}
export function ScreenDetailsMobile() {
  return <ScreenPage state="details" viewport="mobile" />;
}
export function HighlightDesktop() {
  return <ScreenPage state="highlight" viewport="desktop" />;
}
export function HighlightMobile() {
  return <ScreenPage state="highlight" viewport="mobile" />;
}
export function NestedSelectionDesktop() {
  return <ScreenPage state="nested" viewport="desktop" />;
}
export function NestedSelectionMobile() {
  return <ScreenPage state="nested" viewport="mobile" />;
}
export function DirectChangeDesktop() {
  return <ScreenPage state="direct-change" viewport="desktop" />;
}
export function DirectChangeMobile() {
  return <ScreenPage state="direct-change" viewport="mobile" />;
}
export function ConsumerDesktop() {
  return <ScreenPage state="consumer" viewport="desktop" />;
}
export function ConsumerMobile() {
  return <ScreenPage state="consumer" viewport="mobile" />;
}

export const inspectionDetailsScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "inspection-details",
  title: "Screen component details",
  colorSchemes: ["light"],
  description:
    "Actual-view instances by owner, repeated selection, supplied props, and a hidden instance.",
  ...artboards({
    desktop: <ScreenDetailsDesktop />,
    mobile: <ScreenDetailsMobile />,
  }),
});
export const inspectionHighlightScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "inspection-highlight",
  title: "Highlight components",
  colorSchemes: ["light"],
  description:
    "A mask dims the surrounding screen and leaves the outer Toolbar and Footer action unchanged.",
  ...artboards({ desktop: <HighlightDesktop />, mobile: <HighlightMobile /> }),
});
export const inspectionNestedScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "inspection-nested",
  title: "Select a nested component",
  colorSchemes: ["light"],
  description:
    "The Toolbar action is selected in Props and in the screen, with its parent content dimmed.",
  ...artboards({
    desktop: <NestedSelectionDesktop />,
    mobile: <NestedSelectionMobile />,
  }),
});
export const inspectionDirectChangeScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "inspection-direct-change",
  title: "Independent screen prop change",
  colorSchemes: ["light"],
  description:
    "Action and Welcome both appear in Changes: Welcome independently changed the label it supplies. The total is two, including one screen and one component.",
  ...artboards({
    desktop: <DirectChangeDesktop />,
    mobile: <DirectChangeMobile />,
  }),
});
export const inspectionConsumerScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "inspection-consumer",
  title: "Open a consuming screen",
  colorSchemes: ["light"],
  description:
    "The Details screen reached from Action's Used by list, with its own one-instance usage and props.",
  ...artboards({ desktop: <ConsumerDesktop />, mobile: <ConsumerMobile /> }),
});
