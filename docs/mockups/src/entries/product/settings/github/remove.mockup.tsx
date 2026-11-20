import { defineScreen } from "@mokly/mokly";

import {
  SettingsGitHubRemoveLoadingScreen,
  SettingsGitHubRemoveScreen,
} from "../../../../screens/product/settings/github-remove";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsGitHubRemoveScreen,
  loading: SettingsGitHubRemoveLoadingScreen,
};

export default defineScreen({
  title: "Remove a GitHub account",
  description:
    "Remove a GitHub account — the question asked over the row it belongs to, naming what stops and what stays. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/github-app.md",
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
      title: "Remove a GitHub account · Working",
      description:
        "Remove a GitHub account — the write in flight: Remove is busy with Removing…, Cancel waits disabled, and screen readers hear Removing GitHub account. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
  ],
});
