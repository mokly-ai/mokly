import { defineScreen } from "@mokly/mokly";

import { SettingsProjectScopeLoadingScreen } from "../../../../screens/product/settings/project-pane";

export default defineScreen({
  title: "Project · Settings loading",
  description:
    "Project — asked for by its address while the settings scope loads: the rail draws the sections that the address's scope gives an owner, and the pane draws its own layout, with the name waiting in its frame, each fact's value a bar, Change, the visibility change and Save changes as placeholders, and the Automatic builds switch as a placeholder beside its label. Screen readers hear Loading settings. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "loading"],
  render: (_props, context) => (
    <SettingsProjectScopeLoadingScreen viewport={context.viewport} />
  ),
});
