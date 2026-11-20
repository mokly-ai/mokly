import { defineScreen } from "@mokly/mokly";

import { SettingsWorkspacePlanScreen } from "../../../../screens/product/settings/workspace-pane";

export default defineScreen({
  title: "Workspace · Back on the free plan",
  description:
    "Workspace — a workspace that has returned to the free plan, keeping its projects and publications, with the private ones that take no new publication named beneath them. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-plan-gates.md",
  ],
  tags: ["product", "folio", "settings", "plan"],
  render: (_props, context) => (
    <SettingsWorkspacePlanScreen viewport={context.viewport} />
  ),
});
