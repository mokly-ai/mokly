import { defineScreen } from "@mokly/mokly";

import {
  PreviewCallbackFailureScreen,
  PreviewCallbackInvalidScreen,
} from "../../../../screens/product/account/callback-screen";

/** The named screen component that each state draws. */
const screens = {
  invalid: PreviewCallbackInvalidScreen,
  failure: PreviewCallbackFailureScreen,
};

export default defineScreen({
  title: "Preview sign-in link · Invalid",
  description: "Recovery for a missing or invalid preview sign-in link.",

  relatedDocs: [
    "docs/protocol/cloud/auth-callbacks.md",
    "docs/protocol/cloud/preview-seed.md",
    "docs/protocol/cloud/product-mockups.md",
  ],
  tags: ["product", "folio", "account", "callback", "preview", "invalid"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["invalid", "failure"] } },
  } as const,
  props: { state: "invalid" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "failure",
      title: "Preview sign-in link · Failure",
      description:
        "Recovery for a preview sign-in request that can be retried.",
      tags: ["product", "folio", "account", "callback", "preview", "error"],
      props: { state: "failure" },
    },
  ],
});
