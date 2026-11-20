import { defineScreen } from "@mokly/mokly";

import { SettingsBillingDelayedScreen } from "../../../../screens/product/settings/billing-pane";
import { SettingsBillingCheckingScreen } from "../../../../screens/product/settings/billing-writes";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsBillingDelayedScreen,
  checking: SettingsBillingCheckingScreen,
};

export default defineScreen({
  title: "Billing · Confirmation delayed",
  description:
    "Billing — Checkout returned but the bounded confirmation ended before Team appeared, with one fresh read available. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-subscriptions.md",
  ],
  tags: ["product", "folio", "settings", "billing", "delayed"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "checking"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, context) => {
    const Screen = screens[state];
    return <Screen viewport={context.viewport} />;
  },
  variants: [
    {
      slug: "checking",
      title: "Billing · Checking again",
      description:
        "Billing — Check again's write: its one fresh read of the subscription runs, the control is busy with Checking…, the notice stays, and screen readers hear Checking your subscription. The pane inserts nothing. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "billing", "pending"],
      props: { state: "checking" },
    },
  ],
});
