import { defineScreen } from "@mokly/mokly";

import { SettingsBillingUnavailableScreen } from "../../../../screens/product/settings/billing-pane";

export default defineScreen({
  title: "Billing · Opens soon",
  description:
    "Billing — a deployment with no billing configured, which every preview environment runs as. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-subscriptions.md",
  ],
  tags: ["product", "folio", "settings", "unavailable"],
  render: (_props, context) => (
    <SettingsBillingUnavailableScreen viewport={context.viewport} />
  ),
});
