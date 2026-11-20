import { defineScreen } from "@mokly/mokly";

import {
  MagicLinkEmptyScreen,
  MagicLinkErrorScreen,
  MagicLinkLoadingScreen,
  MagicLinkScreen,
} from "../../../screens/product/account/magic-link-screen";

/** The named screen component that each state draws. */
const screens = {
  default: MagicLinkScreen,
  empty: MagicLinkEmptyScreen,
  loading: MagicLinkLoadingScreen,
  error: MagicLinkErrorScreen,
};

export default defineScreen({
  title: "Check your email",
  description:
    "Check your email \u2014 default scenario. Static controls depict the documented action; no live writes occur.",

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
      title: "Check your email \u00b7 Empty",
      description:
        "Check your email \u2014 empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Check your email \u00b7 Loading",
      description:
        "Check your email \u2014 loading scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Check your email \u00b7 Error",
      description:
        "Check your email \u2014 error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "error"],
      props: { state: "error" },
    },
  ],
});
