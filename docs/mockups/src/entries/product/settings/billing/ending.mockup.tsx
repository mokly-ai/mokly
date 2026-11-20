import { defineScreen } from "@mokly/mokly";

import { SettingsBillingEndingScreen } from "../../../../screens/product/settings/billing-pane";

export default defineScreen({
  title: "Billing · Ending",
  description:
    "Billing — cancelled, and Team until the period it is paid for ends. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-subscriptions.md",
  ],
  tags: ["product", "folio", "settings", "ending"],
  render: (_props, context) => (
    <SettingsBillingEndingScreen viewport={context.viewport} />
  ),
});
