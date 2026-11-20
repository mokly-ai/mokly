import { defineScreen } from "@mokly/mokly";

import { SettingsBillingPastDueScreen } from "../../../../screens/product/settings/billing-pane";

export default defineScreen({
  title: "Billing · Payment failed",
  description:
    "Billing — a payment that failed, with the one action that updates the payment method. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-subscriptions.md",
  ],
  tags: ["product", "folio", "settings", "past-due"],
  render: (_props, context) => (
    <SettingsBillingPastDueScreen viewport={context.viewport} />
  ),
});
