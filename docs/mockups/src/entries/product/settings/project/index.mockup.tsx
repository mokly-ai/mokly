import { defineScreen } from "@mokly/mokly";

import {
  SettingsProjectEmptyScreen,
  SettingsProjectErrorScreen,
  SettingsProjectLoadingScreen,
  SettingsProjectNoBuildsScreen,
  SettingsProjectScreen,
} from "../../../../screens/product/settings/project-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsProjectScreen,
  empty: SettingsProjectEmptyScreen,
  loading: SettingsProjectLoadingScreen,
  error: SettingsProjectErrorScreen,
  "no-builds": SettingsProjectNoBuildsScreen,
};

export default defineScreen({
  title: "Project",
  description:
    "Project — default scenario, with the administrator's Automatic builds switch beneath the project's facts. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/viewer-builds.md",
  ],
  tags: ["product", "folio", "settings", "default"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: { enum: ["default", "empty", "loading", "error", "no-builds"] },
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
      title: "Project · Empty",
      description:
        "Project — empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Project · Loading",
      description:
        "Project — saving the name: Save changes is busy with Saving…, Make public and the Automatic builds switch stay live because each is a write of its own, and screen readers hear Saving settings. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Project · Error",
      description:
        "Project — error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
    {
      slug: "no-builds",
      title: "Project · No builds",
      description:
        "Project — a project that cannot build says how it publishes in one sentence where the Automatic builds switch would be.",
      tags: ["product", "folio", "settings", "no-builds"],
      props: { state: "no-builds" },
    },
  ],
});
