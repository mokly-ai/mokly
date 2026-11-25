import { defineScreen } from "@mokly/mokly";

import {
  SignInPasswordEmptyScreen,
  SignInPasswordFailureScreen,
  SignInPasswordRefusedScreen,
  SignInPasswordScreen,
} from "../../../../../screens/product/account/sign-in-screen";

/** The named screen component that each state draws. */
const screens = {
  default: SignInPasswordScreen,
  empty: SignInPasswordEmptyScreen,
  "password-refused": SignInPasswordRefusedScreen,
  failure: SignInPasswordFailureScreen,
};

export default defineScreen({
  title: "Sign in · Preview password",
  description:
    "Sign in where the configuration answer names a shared account, as a pull request preview's does: under the email form, a second or rule, the Password field and Continue as preview@mokly.ai in the secondary tone, so Continue with email stays the one primary. Sign in elsewhere, sign up and the desktop app's window draw no section. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups-account.md",
    "docs/protocol/cloud/folio-chrome-account.md",
    "docs/protocol/cloud/preview-sign-in.md",
  ],
  tags: ["product", "folio", "account", "preview-password"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: { enum: ["default", "empty", "password-refused", "failure"] },
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
      title: "Sign in · Preview password · Empty",
      description:
        "Sign in with the section before the reader types: the Email and Password fields are empty, so Continue with email and Continue as preview@mokly.ai wait disabled until their own field holds more than white space, while Continue with GitHub is ready. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "password-refused",
      title: "Sign in · Preview password · Password refused",
      description:
        "The password Mokly refused, marked on the Password field with the sentence that says so, while Continue as preview@mokly.ai keeps its own label and the email form stays at rest. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "password-refused"],
      props: { state: "password-refused" },
    },
    {
      slug: "failure",
      title: "Sign in · Preview password · Failure",
      description:
        "The password sign-in refused for a cause other than the password, such as a busy Mokly or the rate limit, reported beside its control, which reads Try again, with the password kept and unmarked and the email form at rest. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "error"],
      props: { state: "failure" },
    },
  ],
});
