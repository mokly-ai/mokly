import { defineScreen } from "@mokly/mokly";

import { SettingsBillingAdminFreeScreen } from "../../../../screens/product/settings/billing-pane";

export default defineScreen({
  title: "Billing · Admin on Free",
  description:
    "The Free plan read by an admin: Team prices and trial terms, with billing changes left to an owner.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-subscriptions.md",
  ],
  tags: ["product", "folio", "settings", "billing", "admin", "empty"],
  render: (_props, context) => (
    <SettingsBillingAdminFreeScreen viewport={context.viewport} />
  ),
});
