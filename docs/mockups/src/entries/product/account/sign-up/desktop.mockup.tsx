import { defineScreen } from "@mokly/mokly";

import {
  SignUpDesktopScreen,
  SignUpDesktopWaitingScreen,
} from "../../../../screens/product/account/sign-up-screen";

/** The named screen component that each state draws. */
const screens = {
  default: SignUpDesktopScreen,
  waiting: SignUpDesktopWaitingScreen,
};

export default defineScreen({
  title: "Sign up · Desktop app",
  description:
    "Sign up in the desktop app's window: Create your account and one action, Continue in browser, which opens the connect page in the browser, with no email field, no GitHub action and no switch to sign in. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups-account-desktop.md",
    "docs/protocol/cloud/desktop-sign-in.md",
    "docs/protocol/cloud/desktop-app.md",
  ],
  tags: ["product", "folio", "account", "desktop", "default"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "waiting"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "waiting",
      title: "Sign up · Desktop app · Waiting",
      description:
        "The window while the connect page is open in the browser: Check your browser, and Open browser again opens that page again with the same challenge. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "desktop", "waiting"],
      props: { state: "waiting" },
    },
  ],
});
