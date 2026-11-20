import { defineScreen } from "@mokly/mokly";

import {
  SettingsMembersRemoveLoadingScreen,
  SettingsMembersRemoveScreen,
} from "../../../../screens/product/settings/members-remove";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsMembersRemoveScreen,
  loading: SettingsMembersRemoveLoadingScreen,
};

export default defineScreen({
  title: "Remove a member",
  description:
    "Remove a member — the question asked over the person it concerns. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "default"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "loading"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, context) => {
    const Screen = screens[state];
    return <Screen viewport={context.viewport} />;
  },
  variants: [
    {
      slug: "loading",
      title: "Remove a member · Working",
      description:
        "Remove a member — the write in flight: the removal is busy with Removing…, Keep access waits disabled, and screen readers hear Removing member. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
  ],
});
