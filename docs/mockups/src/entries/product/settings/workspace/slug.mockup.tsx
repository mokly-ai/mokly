import { defineScreen } from "@mokly/mokly";

import {
  SettingsWorkspaceSlugEmptyScreen,
  SettingsWorkspaceSlugErrorScreen,
  SettingsWorkspaceSlugLoadingScreen,
  SettingsWorkspaceSlugScreen,
} from "../../../../screens/product/settings/workspace-slug-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsWorkspaceSlugScreen,
  empty: SettingsWorkspaceSlugEmptyScreen,
  loading: SettingsWorkspaceSlugLoadingScreen,
  error: SettingsWorkspaceSlugErrorScreen,
};

export default defineScreen({
  title: "Workspace address",
  description:
    "Editing the workspace slug with its live address and link consequence.",

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
      title: "Workspace address · Invalid",
      description: "A malformed workspace slug stays on its field.",
      tags: ["product", "folio", "settings", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Workspace address · Saving",
      description:
        "The workspace address draft stays visible while saving: Save changes is busy with Saving…, and screen readers hear Saving workspace address.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Workspace address · In use",
      description:
        "A taken workspace slug stays editable beside the API suggestion.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
  ],
});
