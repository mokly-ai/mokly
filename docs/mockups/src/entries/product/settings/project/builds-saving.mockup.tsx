import { defineScreen } from "@mokly/mokly";

import { SettingsProjectBuildsSavingScreen } from "../../../../screens/product/settings/project-pane";

export default defineScreen({
  title: "Project · Saving automatic builds",
  description:
    "Project — the Automatic builds switch while its own write runs: the switch shows the value the reader asked for, disabled, with Saving… in its own row beside its label, and screen readers hear Saving automatic builds. The pane around it keeps its place, because the switch writes without Save. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/viewer-builds.md",
  ],
  tags: ["product", "folio", "settings", "pending"],
  render: (_props, context) => (
    <SettingsProjectBuildsSavingScreen viewport={context.viewport} />
  ),
});
