import { defineScreen } from "@mokly/mokly";

import { SettingsMembersRoleSavingScreen } from "../../../../screens/product/settings/members-pane";

export default defineScreen({
  title: "Members · Saving a role",
  description:
    "Members — Save role's write for the person the reader manages: the control is busy with Saving…, the role it sends and the removal wait disabled, and screen readers hear Saving role. The pane inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "pending"],
  render: (_props, context) => (
    <SettingsMembersRoleSavingScreen viewport={context.viewport} />
  ),
});
