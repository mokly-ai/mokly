import { defineScreen } from "@mokly/mokly";

import { SettingsBillingUnpricedScreen } from "../../../../screens/product/settings/billing-pane";

export default defineScreen({
  title: "Billing · Unverified price",
  description:
    "Billing — a free workspace whose configured price could not be verified, so Team keeps its way on and the plans are read on the public site. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-subscriptions.md",
  ],
  tags: ["product", "folio", "settings", "unpriced"],
  render: (_props, context) => (
    <SettingsBillingUnpricedScreen viewport={context.viewport} />
  ),
});
