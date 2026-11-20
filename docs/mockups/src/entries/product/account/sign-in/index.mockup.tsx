import { defineScreen } from "@mokly/mokly";

import {
  SignInEmptyScreen,
  SignInErrorScreen,
  SignInLoadingScreen,
  SignInScreen,
} from "../../../../screens/product/account/sign-in-screen";

/** The named screen component that each state draws. */
const screens = {
  default: SignInScreen,
  empty: SignInEmptyScreen,
  loading: SignInLoadingScreen,
  error: SignInErrorScreen,
};

export default defineScreen({
  title: "Sign in",
  description:
    "Sign in — default scenario. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/marketing-site.md",
  ],
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
  useCasePaths: ["flows/product-invitation"],
  variants: [
    {
      slug: "empty",
      title: "Sign in · Empty",
      description:
        "Sign in — empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Sign in · Loading",
      description:
        "Sign in — loading scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Sign in · Error",
      description:
        "Sign in — error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "error"],
      props: { state: "error" },
    },
  ],
});
