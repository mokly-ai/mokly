import { defineScreen } from "@mokly/mokly";

import {
  SettingsAccountDesktopScreen,
  SettingsAccountEmptyScreen,
  SettingsAccountErrorScreen,
  SettingsAccountLoadingScreen,
  SettingsAccountScreen,
} from "../../../../screens/product/settings/account-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsAccountScreen,
  empty: SettingsAccountEmptyScreen,
  loading: SettingsAccountLoadingScreen,
  error: SettingsAccountErrorScreen,
  desktop: SettingsAccountDesktopScreen,
};

export default defineScreen({
  title: "Account",
  description:
    "Account — default scenario. Static controls depict the documented action; no live writes occur.",

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
      state: { enum: ["default", "empty", "loading", "error", "desktop"] },
    },
  } as const,
  props: { state: "default" },
  render: ({ state }, context) => {
    const Screen = screens[state];
    return <Screen viewport={context.viewport} />;
  },
  variants: [
    {
      slug: "empty",
      title: "Account · Empty",
      description:
        "Account — empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Account · Loading",
      description:
        "Account — saving the name: Save changes is busy with Saving…, the name stays in its field, and screen readers hear Saving your name. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Account · Error",
      description:
        "Account — error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
    {
      slug: "desktop",
      title: "Account · Desktop app",
      description:
        "The pane in the desktop app's window for a reader without GitHub: Connect GitHub keeps its label, carries the external glyph and opens this pane on the web. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "desktop"],
      props: { state: "desktop" },
    },
  ],
});
