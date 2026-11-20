import { defineScreen } from "@mokly/mokly";

import {
  SettingsProjectSlugConflictScreen,
  SettingsProjectSlugEmptyScreen,
  SettingsProjectSlugErrorScreen,
  SettingsProjectSlugLoadingScreen,
  SettingsProjectSlugScreen,
} from "../../../../screens/product/settings/project-slug-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsProjectSlugScreen,
  empty: SettingsProjectSlugEmptyScreen,
  loading: SettingsProjectSlugLoadingScreen,
  error: SettingsProjectSlugErrorScreen,
  conflict: SettingsProjectSlugConflictScreen,
};

export default defineScreen({
  title: "Project address",
  description:
    "Editing the project slug with its live address and link consequence.",

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
      state: { enum: ["default", "empty", "loading", "error", "conflict"] },
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
      title: "Project address · Invalid",
      description: "A malformed project slug stays on its field.",
      tags: ["product", "folio", "settings", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Project address · Saving",
      description:
        "The project address draft stays visible while saving: Save changes is busy with Saving…, and screen readers hear Saving project address.",
      tags: ["product", "folio", "settings", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Project address · In use",
      description:
        "A taken project slug stays editable beside the API suggestion.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "error" },
    },
    {
      slug: "conflict",
      title: "Project address · Changed elsewhere",
      description:
        "A concurrent project edit keeps the draft and offers the latest value.",
      tags: ["product", "folio", "settings", "error"],
      props: { state: "conflict" },
    },
  ],
});
