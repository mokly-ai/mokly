import { defineScreen } from "@mokly/mokly";

import {
  SettingsMembersEmptyScreen,
  SettingsMembersErrorScreen,
  SettingsMembersIdentityScreen,
  SettingsMembersLoadingScreen,
  SettingsMembersScreen,
} from "../../../../screens/product/settings/members-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsMembersScreen,
  empty: SettingsMembersEmptyScreen,
  loading: SettingsMembersLoadingScreen,
  error: SettingsMembersErrorScreen,
  identity: SettingsMembersIdentityScreen,
};

export default defineScreen({
  title: "Members",
  description:
    "Members — default scenario. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "default"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: { enum: ["default", "empty", "loading", "error", "identity"] },
    },
  } as const,
  props: { state: "default" },
  render: ({ state }, context) => {
    const Screen = screens[state];
    return <Screen viewport={context.viewport} />;
  },
  useCasePaths: ["flows/product-invitation"],
  variants: [
    {
      slug: "empty",
      title: "Members · Empty",
      description:
        "Members — empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Members · Loading",
      description:
        "Members — the members read: each section keeps its heading, each list draws one placeholder row, the invite form waits in place, nobody is managed yet, and screen readers hear Loading members. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Members · Error",
      description:
        "Members — error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
    {
      slug: "identity",
      title: "Members · Managed by address",
      description:
        "Members — managing someone listed by their email address, which is longer than the panel's column. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "identity"],
      props: { state: "identity" },
    },
  ],
});
