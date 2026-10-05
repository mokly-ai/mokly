import { defineScreen } from "@mokly/mokly";

import { LiveScreenWorkspace } from "../parts/live_screen.js";
import { WorkspaceModeScreen } from "../parts/workspace_screen.js";

export function LiveComponentDesktop() {
  return <WorkspaceModeScreen live viewport="desktop" />;
}
export function LiveComponentMobile() {
  return <WorkspaceModeScreen live viewport="mobile" />;
}
export function LiveScreenDesktop() {
  return <LiveScreenWorkspace viewport="desktop" />;
}
export function LiveScreenMobile() {
  return <LiveScreenWorkspace viewport="mobile" />;
}
export function StaticCatalogueDesktop() {
  return <WorkspaceModeScreen live={false} viewport="desktop" />;
}
export function StaticCatalogueMobile() {
  return <WorkspaceModeScreen live={false} viewport="mobile" />;
}

/** Workspaces in Live, and a workspace without a preview-mode control. */
export const workspaceScreens = [
  defineScreen({
    dependencies: [
      "examples/basic/generated/design-stage.css",
      "examples/basic/generated/design.css",
    ],
    relatedDocs: ["docs/protocol/mokly-interactive-views-design.md"],
    slug: "component",
    title: "Component in Live",
    colorSchemes: ["light"],
    description:
      "A saved example with Live selected: the inspector keeps every tab, and the tabs that read or edit the view point back to Static.",
    desktop: <LiveComponentDesktop />,
    mobile: <LiveComponentMobile />,
  }),
  defineScreen({
    dependencies: [
      "examples/basic/generated/design-stage.css",
      "examples/basic/generated/design.css",
    ],
    relatedDocs: ["docs/protocol/mokly-interactive-views-design.md"],
    slug: "screen",
    title: "Screen in Live",
    colorSchemes: ["light"],
    description:
      "A screen with Live selected and its Components tab open: the tabs that list, read or edit the components in the view point back to Static, and Details stays the same.",
    desktop: <LiveScreenDesktop />,
    mobile: <LiveScreenMobile />,
  }),
  defineScreen({
    dependencies: [
      "examples/basic/generated/design-stage.css",
      "examples/basic/generated/design.css",
    ],
    relatedDocs: ["docs/protocol/mokly-interactive-views-design.md"],
    slug: "static-catalogue",
    title: "Catalogue without Live",
    colorSchemes: ["light"],
    description:
      "The component workspace in a catalogue that offers no live preview: the toolbar keeps its existing controls with no gap.",
    desktop: <StaticCatalogueDesktop />,
    mobile: <StaticCatalogueMobile />,
  }),
];
