import { defineScreen } from "@mokly/mokly";

import { ViewerSettingsScreen } from "../../../../screens/product/viewer/settings-screen";

export default defineScreen({
  title: "Standalone · Settings",
  description:
    "Standalone — the settings dialog over the viewer, on the Members pane that its rail opens. The account menu's Settings opens the dialog on its index, because it names no pane. The rail keeps every section on the muted surface, and the current pane takes the signal-soft fill. A phone shows the same pane in the settings layer.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/viewer-chrome.md",
  ],
  tags: ["product", "canvas", "viewer", "settings"],
  render: (_props, { viewport }) => (
    <ViewerSettingsScreen viewport={viewport} />
  ),
});
