import { defineScreen } from "@mokly/mokly";

import {
  ChooseRepositoryEmptyScreen,
  ChooseRepositoryErrorScreen,
  ChooseRepositoryLoadingScreen,
  ChooseRepositoryScreen,
  ChooseRepositorySuggestionLoadingScreen,
} from "../../../../screens/product/account/choose-repository-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ChooseRepositoryScreen,
  empty: ChooseRepositoryEmptyScreen,
  loading: ChooseRepositoryLoadingScreen,
  error: ChooseRepositoryErrorScreen,
  "suggestion-loading": ChooseRepositorySuggestionLoadingScreen,
};

export default defineScreen({
  title: "Choose repository",
  description:
    "A workspace with two connected GitHub accounts: the Repository select grouped by account and closed on the chosen repository, the line that changes the list opening the GitHub accounts pane, config path, the project slug with its address, Create project, and the line to the CLI form beneath. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-navigation.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
  ],
  useCasePaths: ["flows/product-onboarding"],
  tags: ["product", "folio", "account", "default"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: {
        enum: ["default", "empty", "loading", "error", "suggestion-loading"],
      },
    },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "empty",
      title: "Choose repository \u00b7 Empty",
      description:
        "No repositories yet in either account: the field disabled over its placeholder, the manage line opening the GitHub accounts pane, and the line to the CLI form. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Choose repository \u00b7 Loading",
      description:
        "The workspace and its repositories loading: the step's own form, with Loading repositories… in the Repository field, the other fields and the address in waiting form, Create project disabled, and the manage line and the line to the CLI form as text with no link. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Choose repository \u00b7 Error",
      description:
        "The repositories failing to load, with Try again and the line to the CLI form, which needs no list. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "error"],
      props: { state: "error" },
    },
    {
      slug: "suggestion-loading",
      title: "Choose repository · Finding an address",
      description:
        "The populated repository form retains its editable address while a suggestion loads, and the address line says Finding an available address… in place of the address.",
      tags: ["product", "folio", "account", "loading"],
      props: { state: "suggestion-loading" },
    },
  ],
});
