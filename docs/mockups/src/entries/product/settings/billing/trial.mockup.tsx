import { defineScreen } from "@mokly/mokly";

import { SettingsBillingTrialScreen } from "../../../../screens/product/settings/billing-pane";

export default defineScreen({
  title: "Billing · Trial",
  description:
    "Billing — Team until the trial ends, with the date it is first billed. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-subscriptions.md",
  ],
  tags: ["product", "folio", "settings", "trial"],
  render: (_props, context) => (
    <SettingsBillingTrialScreen viewport={context.viewport} />
  ),
});
