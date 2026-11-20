import { defineScreen } from "@mokly/mokly";

import {
  SettingsProjectMakingPrivateScreen,
  SettingsProjectPlanAdminScreen,
  SettingsProjectPlanScreen,
  SettingsProjectVisibilityScreen,
} from "../../../../screens/product/settings/project-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsProjectVisibilityScreen,
  plan: SettingsProjectPlanScreen,
  "plan-admin": SettingsProjectPlanAdminScreen,
  private: SettingsProjectMakingPrivateScreen,
};

export default defineScreen({
  title: "Project · Changing visibility",
  description:
    "Project — the visibility modal in flight over the pane: Make public is busy with Making public…, Keep private waits disabled, screen readers hear Making Mokly Cloud public, and the separate name draft stays in place beneath it. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "pending"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: { enum: ["default", "plan", "plan-admin", "private"] },
    },
  } as const,
  props: { state: "default" },
  render: ({ state }, context) => {
    const Screen = screens[state];
    return <Screen viewport={context.viewport} />;
  },
  variants: [
    {
      slug: "plan",
      title: "Project · Private on the free plan",
      description:
        "Project — the visibility modal after the free plan refuses to make a public project private, with the owner's way to Billing. Static controls depict the documented action; no live writes occur.",
      relatedDocs: [
        "docs/protocol/cloud/product-mockups.md",
        "docs/protocol/cloud/settings-dialog.md",
        "docs/protocol/cloud/billing.md",
        "docs/protocol/cloud/billing-plan-gates.md",
      ],
      tags: ["product", "folio", "settings", "plan"],
      props: { state: "plan" },
    },
    {
      slug: "plan-admin",
      title: "Project · Private on the free plan, as an admin",
      description:
        "Project — the same refused visibility modal read by an admin, whose way on is asking an owner to upgrade. Static controls depict the documented action; no live writes occur.",
      relatedDocs: [
        "docs/protocol/cloud/product-mockups.md",
        "docs/protocol/cloud/settings-dialog.md",
        "docs/protocol/cloud/billing.md",
        "docs/protocol/cloud/billing-plan-gates.md",
      ],
      tags: ["product", "folio", "settings", "plan-admin"],
      props: { state: "plan-admin" },
    },
    {
      slug: "private",
      title: "Project · Making private",
      description:
        "Project — the visibility modal in flight for a public project made private: Make private is busy with Making private…, Keep public waits disabled, and screen readers hear Making Mokly Cloud private. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "pending"],
      props: { state: "private" },
    },
  ],
});
