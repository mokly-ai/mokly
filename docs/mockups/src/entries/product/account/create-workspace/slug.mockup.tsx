import { defineScreen } from "@mokly/mokly";

import {
  CreateWorkspaceSlugReservedScreen,
  CreateWorkspaceSlugTakenScreen,
  CreateWorkspaceSuggestionErrorScreen,
} from "../../../../screens/product/account/create-workspace-screen";

/** The named screen component that each state draws. */
const screens = {
  default: CreateWorkspaceSlugTakenScreen,
  empty: CreateWorkspaceSuggestionErrorScreen,
  error: CreateWorkspaceSlugReservedScreen,
};

export default defineScreen({
  title: "Create workspace · Address in use",
  description:
    "The attempted workspace address stays editable beside the API suggestion.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-navigation.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
  ],
  tags: ["product", "folio", "account", "error"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "empty", "error"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "empty",
      title: "Create workspace · Address unavailable",
      description:
        "The address suggestion could not load; the slug stays empty and editable with one retry.",
      tags: ["product", "folio", "account", "error"],
      props: { state: "empty" },
    },
    {
      slug: "error",
      title: "Create workspace · Address unavailable",
      description:
        "A reserved workspace address stays editable beside the API suggestion.",
      tags: ["product", "folio", "account", "error"],
      props: { state: "error" },
    },
  ],
});
