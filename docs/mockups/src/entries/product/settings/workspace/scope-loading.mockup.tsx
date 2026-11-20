import { defineScreen } from "@mokly/mokly";

import { SettingsWorkspaceScopeLoadingScreen } from "../../../../screens/product/settings/workspace-pane";

export default defineScreen({
  title: "Workspace · Settings loading",
  description:
    "Workspace — asked for by its address while the settings scope loads: the rail draws the sections that the address's scope gives an owner, and the pane draws its own layout, with the name waiting in its frame, each fact's value a bar, Change, Manage and Save changes as placeholders, Create project drawn disabled and one placeholder row for the projects. Screen readers hear Loading settings. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "loading"],
  render: (_props, context) => (
    <SettingsWorkspaceScopeLoadingScreen viewport={context.viewport} />
  ),
});
