import { defineScreen } from "@mokly/mokly";

import { SettingsBillingScopeLoadingScreen } from "../../../../screens/product/settings/billing-waits";

export default defineScreen({
  title: "Billing · Settings loading",
  description:
    "Billing — asked for by its address while the session and the settings scope load, as Stripe's Checkout and Customer Portal return to it: the rail draws the sections that the address's scope gives an owner, and the pane draws the subscribed workspace's facts with every value a bar, the plan's included, because the pane's own read has not started, and Manage billing as a placeholder. The dialog over the page beneath draws it, and on a wide surface the durable route draws the same wait until it hands over to that dialog, with the panes it has no address for disabled. Screen readers hear Loading settings. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
  ],
  tags: ["product", "folio", "settings", "loading"],
  render: (_props, context) => (
    <SettingsBillingScopeLoadingScreen viewport={context.viewport} />
  ),
});
