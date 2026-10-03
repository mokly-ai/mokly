import { defineScreen } from "@mokly/mokly";

import { componentDesignMetadata } from "../../../metadata.js";
import { ScreenPage } from "../../parts/screen_page.js";

export function ToolbarSelectionDesktop() {
  return <ScreenPage state="toolbar-selection" viewport="desktop" />;
}
export function ToolbarSelectionMobile() {
  return <ScreenPage state="toolbar-selection" viewport="mobile" />;
}
export function HelpSelectionDesktop() {
  return <ScreenPage state="help-selection" viewport="desktop" />;
}
export function HelpSelectionMobile() {
  return <ScreenPage state="help-selection" viewport="mobile" />;
}

export const selectionScreens = [
  defineScreen({
    ...componentDesignMetadata,
    slug: "inspection-toolbar",
    title: "Select a container instance",
    colorSchemes: ["light"],
    description:
      "Toolbar's usage link opens Welcome with the Main toolbar selected and its supplied prompt visible.",
    desktop: <ToolbarSelectionDesktop />,
    mobile: <ToolbarSelectionMobile />,
  }),
  defineScreen({
    ...componentDesignMetadata,
    slug: "inspection-help",
    title: "Select an invisible instance",
    colorSchemes: ["light"],
    description:
      "Help hint's usage link opens its actual instance, with visibility false and no invented bounds.",
    desktop: <HelpSelectionDesktop />,
    mobile: <HelpSelectionMobile />,
  }),
];
