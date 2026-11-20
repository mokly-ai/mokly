import { defineScreen } from "@mokly/mokly";

import {
  ChooseRepositorySlugTakenScreen,
  ChooseRepositorySuggestionErrorScreen,
} from "../../../../screens/product/account/choose-repository-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ChooseRepositorySlugTakenScreen,
  empty: ChooseRepositorySuggestionErrorScreen,
};

export default defineScreen({
  title: "Choose repository · Address in use",
  description:
    "The selected repository keeps its project address field and API suggestion.",

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
    properties: { state: { enum: ["default", "empty"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "empty",
      title: "Choose repository · Address unavailable",
      description:
        "The address suggestion could not load; the slug stays empty and editable with one retry.",
      tags: ["product", "folio", "account", "empty", "error"],
      props: { state: "empty" },
    },
  ],
});
