import { defineScreen } from "@mokly/mokly";

import {
  SettingsTokensEmptyScreen,
  SettingsTokensErrorScreen,
  SettingsTokensLoadingScreen,
  SettingsTokensScreen,
} from "../../../../screens/product/settings/tokens-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsTokensScreen,
  empty: SettingsTokensEmptyScreen,
  loading: SettingsTokensLoadingScreen,
  error: SettingsTokensErrorScreen,
};

export default defineScreen({
  title: "Publishing tokens",
  description:
    "Publishing tokens — default scenario. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
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
      title: "Publishing tokens · Empty",
      description:
        "Publishing tokens — empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Publishing tokens · Loading",
      description:
        "Publishing tokens — the tokens read: a bar for the heading only a list with a token shows, a placeholder for its control and one placeholder row, and screen readers hear Loading publishing tokens. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Publishing tokens · Error",
      description:
        "Publishing tokens — error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
  ],
});
