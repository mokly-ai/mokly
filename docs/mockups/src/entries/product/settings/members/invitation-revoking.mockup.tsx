import { defineScreen } from "@mokly/mokly";

import { SettingsMembersInvitationRevokingScreen } from "../../../../screens/product/settings/members-pane";

export default defineScreen({
  title: "Members · Revoking an invitation",
  description:
    "Members — Revoke invitation's write: the pending invitation's control is busy with Revoking… on its own row, screen readers hear Revoking invitation, and the rest of the pane stays as it was. The pane inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "pending"],
  render: (_props, context) => (
    <SettingsMembersInvitationRevokingScreen viewport={context.viewport} />
  ),
});
