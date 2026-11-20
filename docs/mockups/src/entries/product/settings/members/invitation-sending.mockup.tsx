import { defineScreen } from "@mokly/mokly";

import { SettingsMembersInvitationSendingScreen } from "../../../../screens/product/settings/members-pane";

export default defineScreen({
  title: "Members · Sending an invitation",
  description:
    "Members — Send invitation's write: the control is busy with Sending…, the address and the role it sends wait disabled, screen readers hear Sending invitation, and the lists stay as they were. The pane inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "pending"],
  render: (_props, context) => (
    <SettingsMembersInvitationSendingScreen viewport={context.viewport} />
  ),
});
