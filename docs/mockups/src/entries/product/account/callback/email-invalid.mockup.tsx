import { defineScreen } from "@mokly/mokly";

import {
  EmailCallbackExpiredScreen,
  EmailCallbackFailureScreen,
  EmailCallbackInvalidScreen,
  EmailCallbackUsedScreen,
} from "../../../../screens/product/account/callback-screen";

/** The named screen component that each state draws. */
const screens = {
  invalid: EmailCallbackInvalidScreen,
  expired: EmailCallbackExpiredScreen,
  used: EmailCallbackUsedScreen,
  failure: EmailCallbackFailureScreen,
};

export default defineScreen({
  title: "Email sign-in link · Invalid",
  description: "Recovery for a missing or invalid email sign-in link.",

  relatedDocs: [
    "docs/protocol/cloud/auth-callbacks.md",
    "docs/protocol/cloud/product-mockups.md",
  ],
  tags: ["product", "folio", "account", "callback", "email", "invalid"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["invalid", "expired", "used", "failure"] } },
  } as const,
  props: { state: "invalid" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "expired",
      title: "Email sign-in link · Expired",
      description: "Recovery for an expired email sign-in link.",
      tags: ["product", "folio", "account", "callback", "email", "expired"],
      props: { state: "expired" },
    },
    {
      slug: "used",
      title: "Email sign-in link · Used",
      description: "Recovery for an email sign-in link already used once.",
      tags: ["product", "folio", "account", "callback", "email", "used"],
      props: { state: "used" },
    },
    {
      slug: "failure",
      title: "Email sign-in link · Failure",
      description: "Recovery for another email sign-in request failure.",
      tags: ["product", "folio", "account", "callback", "email", "error"],
      props: { state: "failure" },
    },
  ],
});
