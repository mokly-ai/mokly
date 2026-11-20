import { defineScreen } from "@mokly/mokly";

import { SettingsBillingRouteLoadingScreen } from "../../../../screens/product/settings/billing-waits";

export default defineScreen({
  title: "Billing · Route loading",
  description:
    "Billing — asked for by its durable route, as Stripe's Checkout and Customer Portal return to it, while the route reads the session, the settings scope and the page it hands over to: on a wide surface the dialog's wait over the stage placeholder, with the subscribed workspace's facts as bars and Manage billing as a placeholder, until the dialog over the page beneath takes over. The route's address names its workspace and no project, so the rail draws each Project pane disabled, with no link. On a compact surface the route is the full-screen layer, which draws the same wait. Screen readers hear Loading settings. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/settings-dialog-states.md",
    "docs/protocol/cloud/billing.md",
  ],
  tags: ["product", "folio", "settings", "loading"],
  render: (_props, context) => (
    <SettingsBillingRouteLoadingScreen viewport={context.viewport} />
  ),
});
