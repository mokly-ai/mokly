import { defineScreen } from "@mokly/mokly";

import {
  DesktopCallbackExpiredScreen,
  DesktopCallbackFailureScreen,
} from "../../../../screens/product/account/callback-screen";

/** The named screen component that each state draws. */
const screens = {
  expired: DesktopCallbackExpiredScreen,
  failure: DesktopCallbackFailureScreen,
};

export default defineScreen({
  title: "Desktop sign-in · Expired",
  description:
    "The desktop landing in the app's window when the grant is expired, used or unmatched, or arrived without its verifier while the window is signed out. Back to sign in returns to the window's entry.",
  relatedDocs: [
    "docs/protocol/cloud/auth-callbacks.md",
    "docs/protocol/cloud/desktop-sign-in.md",
    "docs/protocol/cloud/product-mockups-account.md",
    "docs/protocol/cloud/product-mockups-account-desktop.md",
  ],
  tags: ["product", "folio", "account", "callback", "desktop", "expired"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["expired", "failure"] } },
  } as const,
  props: { state: "expired" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "failure",
      title: "Desktop sign-in · Failure",
      description:
        "The desktop landing after another failure of the grant exchange, with its reference. The grant is single use, so it offers no retry.",
      tags: ["product", "folio", "account", "callback", "desktop", "error"],
      props: { state: "failure" },
    },
  ],
});
