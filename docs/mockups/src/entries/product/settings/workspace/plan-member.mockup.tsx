import { defineScreen } from "@mokly/mokly";

import { SettingsWorkspacePlanMemberScreen } from "../../../../screens/product/settings/workspace-pane";

export default defineScreen({
  title: "Workspace · Free plan as a member",
  description:
    "Workspace — a member reads that private projects take no new publication and asks an owner to upgrade. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-plan-gates.md",
  ],
  tags: ["product", "folio", "settings", "plan", "member"],
  render: (_props, context) => (
    <SettingsWorkspacePlanMemberScreen viewport={context.viewport} />
  ),
});
