import { screen } from "@mokly/mokly";

import { WorkspaceModeScreen } from "../parts/workspace_screen.js";

export function LiveComponentDesktop() {
  return <WorkspaceModeScreen live viewport="desktop" />;
}
export function LiveComponentMobile() {
  return <WorkspaceModeScreen live viewport="mobile" />;
}
export function StaticCatalogueDesktop() {
  return <WorkspaceModeScreen live={false} viewport="desktop" />;
}
export function StaticCatalogueMobile() {
  return <WorkspaceModeScreen live={false} viewport="mobile" />;
}

/** A component's saved example with and without a preview-mode control. */
export const workspaceScreens = [
  screen({
    id: "design-interactive-component",
    slug: "component",
    title: "Component in Live",
    colorSchemes: ["light"],
    description:
      "A saved example with Live selected: the inspector keeps every tab, and the tabs that read or edit the view point back to Static.",
    desktop: <LiveComponentDesktop />,
    mobile: <LiveComponentMobile />,
  }),
  screen({
    id: "design-interactive-static-catalogue",
    slug: "static-only",
    title: "Catalogue without Live",
    colorSchemes: ["light"],
    description:
      "The same workspace in a catalogue that offers no live preview: the toolbar keeps its existing controls with no gap.",
    desktop: <StaticCatalogueDesktop />,
    mobile: <StaticCatalogueMobile />,
  }),
];
