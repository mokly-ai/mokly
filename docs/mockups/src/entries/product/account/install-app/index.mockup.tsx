import { defineScreen } from "@mokly/mokly";

import {
  InstallAppEmptyScreen,
  InstallAppErrorScreen,
  InstallAppLoadingScreen,
  InstallAppScreen,
} from "../../../../screens/product/account/install-app-screen";

/** The named screen component that each state draws. */
const screens = {
  default: InstallAppScreen,
  empty: InstallAppEmptyScreen,
  loading: InstallAppLoadingScreen,
  error: InstallAppErrorScreen,
};

export default defineScreen({
  title: "Install GitHub App",
  description:
    "The install step with nothing bound, read by an owner or admin: one action, Install on GitHub, no fact rows, and the line to the CLI form beneath. Static controls depict the documented action; no live writes occur.",

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
    properties: { state: { enum: ["default", "empty", "loading", "error"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "empty",
      title: "Install GitHub App \u00b7 Empty",
      description:
        "Nothing bound is the canonical drawing, so the empty page repeats it. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Install GitHub App \u00b7 Loading",
      description:
        "The workspace read: the owner's and the admin's step, with Loading your workspace… in the line under the title, Install on GitHub as a placeholder, Back, and the line to the CLI form as text with no link. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Install GitHub App \u00b7 Error",
      description:
        "The installation suspended on GitHub, with Resume on GitHub above the same action and the line to the CLI form beneath. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "error"],
      props: { state: "error" },
    },
  ],
});
