import { defineScreen } from "@mokly/mokly";

import { SettingsBillingCheckoutOpeningScreen } from "../../../../screens/product/settings/billing-writes";

export default defineScreen({
  title: "Billing · Opening checkout",
  description:
    "Billing — Upgrade to Team's write on the free plan: the control keeps its place and reads Opening… with the busy spinner until the page leaves for Stripe's Checkout, screen readers hear Opening checkout, and the prices and trial stay. The pane inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-subscriptions.md",
  ],
  tags: ["product", "folio", "settings", "pending"],
  render: (_props, context) => (
    <SettingsBillingCheckoutOpeningScreen viewport={context.viewport} />
  ),
});
