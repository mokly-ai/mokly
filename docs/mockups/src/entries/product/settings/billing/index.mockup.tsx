import { defineScreen } from "@mokly/mokly";

import {
  SettingsBillingEmptyScreen,
  SettingsBillingErrorScreen,
  SettingsBillingLoadingScreen,
  SettingsBillingScreen,
} from "../../../../screens/product/settings/billing-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsBillingScreen,
  empty: SettingsBillingEmptyScreen,
  loading: SettingsBillingLoadingScreen,
  error: SettingsBillingErrorScreen,
};

export default defineScreen({
  title: "Billing",
  description:
    "Billing — default scenario. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-subscriptions.md",
  ],
  tags: ["product", "folio", "settings", "default"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "empty", "loading", "error"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, context) => {
    const Screen = screens[state];
    return <Screen viewport={context.viewport} />;
  },
  variants: [
    {
      slug: "empty",
      title: "Billing · Empty",
      description:
        "Billing — empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Billing · Loading",
      description:
        "Billing — the billing read: the subscribed workspace's facts, each value a bar, with Loading billing… in the plan's place and a placeholder where the action goes. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Billing · Error",
      description:
        "Billing — error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
  ],
});
