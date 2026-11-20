import { defineScreen } from "@mokly/mokly";

import {
  SignUpEmptyScreen,
  SignUpErrorScreen,
  SignUpLoadingScreen,
  SignUpScreen,
} from "../../../../screens/product/account/sign-up-screen";

/** The named screen component that each state draws. */
const screens = {
  default: SignUpScreen,
  empty: SignUpEmptyScreen,
  loading: SignUpLoadingScreen,
  error: SignUpErrorScreen,
};

export default defineScreen({
  title: "Sign up",
  description:
    "Sign up — default scenario. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/marketing-site.md",
  ],
  tags: ["product", "folio", "account", "default"],
  useCasePaths: ["flows/product-onboarding"],
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
      title: "Sign up · Empty",
      description:
        "Sign up — empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Sign up · Loading",
      description:
        "Sign up — loading scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Sign up · Error",
      description:
        "Sign up — error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "error"],
      props: { state: "error" },
    },
  ],
});
