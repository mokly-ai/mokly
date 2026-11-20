import { defineScreen } from "@mokly/mokly";

import {
  SettingsTokensCopyScreen,
  SettingsTokensCreateErrorScreen,
  SettingsTokensCreateLoadingScreen,
  SettingsTokensCreateScreen,
  SettingsTokensRevealScreen,
} from "../../../../screens/product/settings/tokens-create";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsTokensCreateScreen,
  loading: SettingsTokensCreateLoadingScreen,
  error: SettingsTokensCreateErrorScreen,
  reveal: SettingsTokensRevealScreen,
  copy: SettingsTokensCopyScreen,
};

export default defineScreen({
  title: "Create a token",
  description:
    "Create a token — the modal the pane opens to name one. Static controls depict the documented action; no live writes occur.",

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
      state: { enum: ["default", "loading", "error", "reveal", "copy"] },
    },
  } as const,
  props: { state: "default" },
  render: ({ state }, context) => {
    const Screen = screens[state];
    return <Screen viewport={context.viewport} />;
  },
  variants: [
    {
      slug: "loading",
      title: "Create a token · Working",
      description:
        "Create a token — the write in flight: Create token is busy with Creating…, which refuses a second press, and screen readers hear Creating token. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Create a token · Name refused",
      description:
        "Create a token — a name the reader can only answer by editing, so the refusal sits on the field. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
    {
      slug: "reveal",
      title: "Create a token · Save your token",
      description:
        "Create a token — the one render of the secret, and the only chance to take it. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "reveal"],
      props: { state: "reveal" },
    },
    {
      slug: "copy",
      title: "Create a token · Copy refused",
      description:
        "Create a token — the reveal in a browser that would not take the secret on the clipboard. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "clipboard"],
      props: { state: "copy" },
    },
  ],
});
