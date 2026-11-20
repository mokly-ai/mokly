import { defineScreen } from "@mokly/mokly";

import {
  SettingsSectionsEmptyScreen,
  SettingsSectionsErrorScreen,
  SettingsSectionsLoadingScreen,
  SettingsSectionsMacAppScreen,
  SettingsSectionsScreen,
} from "../../../screens/product/settings/sections-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsSectionsScreen,
  empty: SettingsSectionsEmptyScreen,
  loading: SettingsSectionsLoadingScreen,
  error: SettingsSectionsErrorScreen,
  "mac-app": SettingsSectionsMacAppScreen,
};

export default defineScreen({
  title: "Settings",
  description:
    "Settings — default scenario. Static controls depict the documented action; no live writes occur.",

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
      state: { enum: ["default", "empty", "loading", "error", "mac-app"] },
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
      title: "Settings · Empty",
      description:
        "Settings — empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Settings · Loading",
      description:
        "Settings — while the settings scope loads: the rail and the index draw the sections an owner sees, each row's Open is text with no link until the scope gives its address, and screen readers hear Loading settings. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Settings · Error",
      description:
        "Settings — error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
    {
      slug: "mac-app",
      title: "Settings · Mac app",
      description:
        "Settings in the Mac app, whose window has no title bar. The desktop view is a wide window with the dialog over the stage and the window buttons above its backdrop; the mobile view is a narrow window whose layer bar starts after the buttons. Static controls depict the documented action; no live writes occur.",
      relatedDocs: [
        "docs/protocol/cloud/product-mockups.md",
        "docs/protocol/cloud/settings-dialog.md",
        "docs/protocol/cloud/desktop-bundle.md",
      ],
      tags: ["product", "folio", "settings", "mac-app"],
      props: { state: "mac-app" },
    },
  ],
});
