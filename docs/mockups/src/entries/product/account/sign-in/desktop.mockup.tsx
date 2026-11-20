import { defineScreen } from "@mokly/mokly";

import {
  SignInDesktopScreen,
  SignInDesktopWaitingScreen,
} from "../../../../screens/product/account/sign-in-screen";

/** The named screen component that each state draws. */
const screens = {
  default: SignInDesktopScreen,
  waiting: SignInDesktopWaitingScreen,
};

export default defineScreen({
  title: "Sign in · Desktop app",
  description:
    "Sign in in the desktop app's window: Sign in to Mokly and one action, Continue in browser, which opens the connect page in the browser, with no email field, no GitHub action and no switch to sign up. Static controls depict the documented action; no live writes occur.",
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
      title: "Sign in · Desktop app · Waiting",
      description:
        "The window while the connect page is open in the browser: Check your browser, and Open browser again opens that page again with the same challenge. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "desktop", "waiting"],
      props: { state: "waiting" },
    },
  ],
});
