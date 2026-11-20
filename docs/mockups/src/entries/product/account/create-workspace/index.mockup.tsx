import { defineScreen } from "@mokly/mokly";

import {
  CreateWorkspaceEmptyScreen,
  CreateWorkspaceErrorScreen,
  CreateWorkspaceLoadingScreen,
  CreateWorkspaceScreen,
  CreateWorkspaceSuggestionLoadingScreen,
} from "../../../../screens/product/account/create-workspace-screen";

/** The named screen component that each state draws. */
const screens = {
  default: CreateWorkspaceScreen,
  empty: CreateWorkspaceEmptyScreen,
  loading: CreateWorkspaceLoadingScreen,
  error: CreateWorkspaceErrorScreen,
  "suggestion-loading": CreateWorkspaceSuggestionLoadingScreen,
};

export default defineScreen({
  title: "Create workspace",
  description:
    "Create workspace \u2014 default scenario. Static controls depict the documented action; no live writes occur.",

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
      title: "Create workspace \u00b7 Empty",
      description:
        "Create workspace \u2014 empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Create workspace \u00b7 Loading",
      description:
        "The session read: the form's fields and its address in waiting form, Create workspace disabled, and the identity's placeholder in the header. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Create workspace \u00b7 Error",
      description:
        "Create workspace \u2014 error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "error"],
      props: { state: "error" },
    },
    {
      slug: "suggestion-loading",
      title: "Create workspace · Finding an address",
      description:
        "The populated workspace form retains its editable address while a suggestion loads, and the address line says Finding an available address… in place of the address.",
      tags: ["product", "folio", "account", "loading"],
      props: { state: "suggestion-loading" },
    },
  ],
});
