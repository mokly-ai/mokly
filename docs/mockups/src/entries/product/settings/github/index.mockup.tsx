import { defineScreen } from "@mokly/mokly";

import {
  SettingsGitHubEmptyScreen,
  SettingsGitHubErrorScreen,
  SettingsGitHubLoadingScreen,
  SettingsGitHubScreen,
} from "../../../../screens/product/settings/github-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsGitHubScreen,
  empty: SettingsGitHubEmptyScreen,
  loading: SettingsGitHubLoadingScreen,
  error: SettingsGitHubErrorScreen,
};

export default defineScreen({
  title: "GitHub accounts",
  description:
    "GitHub accounts read by an owner: the workspace's two connected accounts, each Personal or Organization behind its own three-dot menu, and Add GitHub account. Static controls depict the documented action; no live writes occur.",
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
      title: "GitHub accounts · Empty",
      description:
        "No GitHub account connected yet, with Add GitHub account for an owner. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "GitHub accounts · Loading",
      description:
        "The accounts loading: a bar for the heading only a list with an account shows, a placeholder for Add GitHub account and one placeholder row, with the pane's landmarks kept and Loading GitHub accounts heard by screen readers. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "GitHub accounts · Error",
      description:
        "The accounts failing to load, with Try again and its reference where the list would be. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
  ],
});
