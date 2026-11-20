import { defineScreen } from "@mokly/mokly";

import {
  SettingsWorkspaceSlugConflictScreen,
  SettingsWorkspaceSlugReservedScreen,
} from "../../../../screens/product/settings/workspace-slug-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsWorkspaceSlugReservedScreen,
  error: SettingsWorkspaceSlugConflictScreen,
};

export default defineScreen({
  title: "Workspace address · Unavailable",
  description:
    "A reserved workspace slug stays editable beside the API suggestion.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "error"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "error"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, context) => {
    const Screen = screens[state];
    return <Screen viewport={context.viewport} />;
  },
  variants: [
    {
      slug: "error",
      title: "Workspace address · Changed elsewhere",
      description:
        "A concurrent workspace edit keeps the draft and offers the latest value.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
  ],
});
