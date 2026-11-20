import { defineScreen } from "@mokly/mokly";

import { SettingsBillingConfirmingScreen } from "../../../../screens/product/settings/billing-pane";

export default defineScreen({
  title: "Billing · Confirming",
  description:
    "Billing — returned from Checkout, re-reading billing until the subscription is confirmed: the facts wait, each value a bar, with Confirming your subscription… in the plan's place. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-subscriptions.md",
  ],
  tags: ["product", "folio", "settings", "confirming"],
  render: (_props, context) => (
    <SettingsBillingConfirmingScreen viewport={context.viewport} />
  ),
});
