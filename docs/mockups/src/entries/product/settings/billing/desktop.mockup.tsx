import { defineScreen } from "@mokly/mokly";

import {
  SettingsBillingDesktopScreen,
  SettingsBillingDesktopTeamScreen,
} from "../../../../screens/product/settings/billing-desktop";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsBillingDesktopScreen,
  team: SettingsBillingDesktopTeamScreen,
};

export default defineScreen({
  title: "Billing · Desktop app",
  description:
    "Billing in the desktop app's window on the free plan: Upgrade to Team keeps its label, carries the external glyph and opens Stripe's Checkout in the browser. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/desktop-app.md",
  ],
  tags: ["product", "folio", "settings", "billing", "desktop"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "team"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, context) => {
    const Screen = screens[state];
    return <Screen viewport={context.viewport} />;
  },
  variants: [
    {
      slug: "team",
      title: "Billing · Desktop app · Team",
      description:
        "Billing in the desktop app's window on Team: Manage billing keeps its label, carries the external glyph and opens Stripe's Customer Portal in the browser. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "billing", "desktop"],
      props: { state: "team" },
    },
  ],
});
