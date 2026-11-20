import { defineScreen } from "@mokly/mokly";

import {
  SettingsDangerEmptyScreen,
  SettingsDangerErrorScreen,
  SettingsDangerLoadingScreen,
  SettingsDangerScopeLoadingScreen,
  SettingsDangerScreen,
} from "../../../screens/product/settings/danger-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsDangerScreen,
  empty: SettingsDangerEmptyScreen,
  loading: SettingsDangerLoadingScreen,
  error: SettingsDangerErrorScreen,
  "scope-loading": SettingsDangerScopeLoadingScreen,
};

export default defineScreen({
  title: "Delete project",
  description:
    "Delete project — default scenario. Static controls depict the documented action; no live writes occur.",

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
      state: {
        enum: ["default", "empty", "loading", "error", "scope-loading"],
      },
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
      title: "Delete project · Empty",
      description:
        "Delete project — empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Delete project · Loading",
      description:
        "Delete project — the deletion in flight: Delete project is busy with Deleting…, the typed name stays, and screen readers hear Deleting project. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Delete project · Error",
      description:
        "Delete project — error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
    {
      slug: "scope-loading",
      title: "Delete project · Settings loading",
      description:
        "Delete project — asked for by its address while the settings scope loads: the rail draws the sections that the address's scope gives an owner, the question and the field's label keep their known words beside a bar for the project's name, the field waits in its frame, and Delete project and Keep project are drawn disabled. Screen readers hear Loading settings. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "scope-loading" },
    },
  ],
});
