import { defineScreen } from "@mokly/mokly";

import {
  SettingsAccessEmptyScreen,
  SettingsAccessErrorScreen,
  SettingsAccessLoadingScreen,
  SettingsAccessScreen,
} from "../../../screens/product/settings/access-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsAccessScreen,
  empty: SettingsAccessEmptyScreen,
  loading: SettingsAccessLoadingScreen,
  error: SettingsAccessErrorScreen,
};

export default defineScreen({
  title: "Access",
  description:
    "Access — default scenario. Static controls depict the documented action; no live writes occur.",

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
      title: "Access · Empty",
      description:
        "Access — empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Access · Loading",
      description:
        "Access — the access read: both sections keep their headings, each list draws one placeholder row, Manage members is disabled, and screen readers hear Loading project access. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Access · Error",
      description:
        "Access — error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
  ],
});
