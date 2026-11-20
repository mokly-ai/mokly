import { defineScreen } from "@mokly/mokly";

import { SettingsBillingAdminScreen } from "../../../../screens/product/settings/billing-pane";

export default defineScreen({
  title: "Billing · Admin",
  description:
    "Billing — the same facts read by an admin, whose way on is asking an owner. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-subscriptions.md",
  ],
  tags: ["product", "folio", "settings", "admin"],
  render: (_props, context) => (
    <SettingsBillingAdminScreen viewport={context.viewport} />
  ),
});
