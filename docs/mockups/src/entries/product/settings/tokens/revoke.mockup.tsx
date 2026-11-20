import { defineScreen } from "@mokly/mokly";

import { SettingsTokensMenuScreen } from "../../../../screens/product/settings/tokens-pane";
import {
  SettingsTokensRevokeLoadingScreen,
  SettingsTokensRevokeScreen,
} from "../../../../screens/product/settings/tokens-revoke";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsTokensRevokeScreen,
  loading: SettingsTokensRevokeLoadingScreen,
  menu: SettingsTokensMenuScreen,
};

export default defineScreen({
  title: "Revoke a token",
  description:
    "Revoke a token — the question asked over the row it belongs to. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "default"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "loading", "menu"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, context) => {
    const Screen = screens[state];
    return <Screen viewport={context.viewport} />;
  },
  variants: [
    {
      slug: "loading",
      title: "Revoke a token · Working",
      description:
        "Revoke a token — the write in flight: Revoke token is busy with Revoking…, Keep token waits disabled, and screen readers hear Revoking token. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "menu",
      title: "Revoke a token · Row actions",
      description:
        "Revoke a token — the row's own actions, open, with revoking named by what it does. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "menu"],
      props: { state: "menu" },
    },
  ],
});
