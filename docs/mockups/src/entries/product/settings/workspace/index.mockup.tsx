import { defineScreen } from "@mokly/mokly";

import {
  SettingsWorkspaceEmptyScreen,
  SettingsWorkspaceErrorScreen,
  SettingsWorkspaceLoadingScreen,
  SettingsWorkspaceScreen,
} from "../../../../screens/product/settings/workspace-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsWorkspaceScreen,
  empty: SettingsWorkspaceEmptyScreen,
  loading: SettingsWorkspaceLoadingScreen,
  error: SettingsWorkspaceErrorScreen,
};

export default defineScreen({
  title: "Workspace",
  description:
    "Workspace — default scenario: the name, the plan, the slug and the GitHub accounts fact naming both connected accounts, with Manage opening the GitHub accounts pane. Static controls depict the documented action; no live writes occur.",

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
      title: "Workspace · Empty",
      description:
        "Workspace — empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Workspace · Loading",
      description:
        "Workspace — the pane's reads: the pane is drawn, the GitHub accounts fact holds its own place, the projects list draws one placeholder row, and screen readers hear Loading projects. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Workspace · Error",
      description:
        "Workspace — error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
  ],
});
