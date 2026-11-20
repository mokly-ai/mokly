import { defineScreen } from "@mokly/mokly";

import { SettingsBillingPortalOpeningScreen } from "../../../../screens/product/settings/billing-writes";

export default defineScreen({
  title: "Billing · Opening the billing portal",
  description:
    "Billing — Manage billing's write on Team: the control keeps its place and reads Opening… with the busy spinner until the page leaves for Stripe's Customer Portal, screen readers hear Opening the billing portal, and the facts stay. The pane inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-subscriptions.md",
  ],
  tags: ["product", "folio", "settings", "pending"],
  render: (_props, context) => (
    <SettingsBillingPortalOpeningScreen viewport={context.viewport} />
  ),
});
