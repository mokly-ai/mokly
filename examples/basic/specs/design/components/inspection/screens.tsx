import { defineScreen } from "@mokly/mokly";

import { componentDesignMetadata } from "../../metadata.js";
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

export const inspectionScreens = [
  defineScreen({
    ...componentDesignMetadata,
    slug: "inspection-details",
    title: "Screen component details",
    colorSchemes: ["light"],
    description:
      "Actual-view instances grouped by component, repeated selection, supplied props, and a hidden instance.",
    desktop: <ScreenDetailsDesktop />,
    mobile: <ScreenDetailsMobile />,
  }),
  defineScreen({
    ...componentDesignMetadata,
    slug: "inspection-highlight",
    title: "Highlight components",
    colorSchemes: ["light"],
    description:
      "A mask dims the surrounding screen and leaves the outer Toolbar and Footer action unchanged.",
    desktop: <HighlightDesktop />,
    mobile: <HighlightMobile />,
  }),
  defineScreen({
    ...componentDesignMetadata,
    slug: "inspection-nested",
    title: "Select a nested component",
    colorSchemes: ["light"],
    description:
      "The Toolbar action is selected in Props and in the screen, with its parent content dimmed.",
    desktop: <NestedSelectionDesktop />,
    mobile: <NestedSelectionMobile />,
  }),
  defineScreen({
    ...componentDesignMetadata,
    slug: "inspection-direct-change",
    title: "Independent screen prop change",
    colorSchemes: ["light"],
    description:
      "Action and Welcome both appear in Changes: Welcome independently changed the label it supplies. The total is two, including one screen and one component.",
    desktop: <DirectChangeDesktop />,
    mobile: <DirectChangeMobile />,
  }),
  defineScreen({
    ...componentDesignMetadata,
    slug: "inspection-consumer",
    title: "Open a consuming screen",
    colorSchemes: ["light"],
    description:
      "The Details screen reached from Action's Used by list, with its own one-instance usage and props.",
    desktop: <ConsumerDesktop />,
    mobile: <ConsumerMobile />,
  }),
];
