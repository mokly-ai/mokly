import { defineScreen } from "@mokly/mokly";

import {
  ConnectDesktopEmptyScreen,
  ConnectDesktopErrorScreen,
  ConnectDesktopLoadingScreen,
  ConnectDesktopOpenedScreen,
  ConnectDesktopScreen,
} from "../../../../screens/product/account/connect-desktop-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ConnectDesktopScreen,
  empty: ConnectDesktopEmptyScreen,
  loading: ConnectDesktopLoadingScreen,
  error: ConnectDesktopErrorScreen,
  opened: ConnectDesktopOpenedScreen,
};

export default defineScreen({
  title: "Sign in to the Mokly app",
  description:
    "The connect page in the browser, `/connect/desktop`: the browser's account, then Open Mokly, which requests the desktop grant and hands it to the app, and Use another account. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups-account.md",
    "docs/protocol/cloud/product-mockups-account-desktop.md",
    "docs/protocol/cloud/desktop-sign-in.md",
    "docs/protocol/cloud/auth-sessions.md",
  ],
  tags: ["product", "folio", "account", "desktop", "default"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: { enum: ["default", "empty", "loading", "error", "opened"] },
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
      title: "Sign in to the Mokly app · Empty",
      description:
        "A link without one valid challenge: This link isn’t valid, with the way back from the app and no action, because the page sends no request. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "desktop", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Sign in to the Mokly app · Loading",
      description:
        "The grant request in flight: Open Mokly keeps its place, busy with Opening… and the busy spinner, and refuses a second press, screen readers hear Opening Mokly, and nothing is inserted beside it. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "desktop", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Sign in to the Mokly app · Error",
      description:
        "The grant request refused, reported beside its control, which becomes Try again, with the reference beneath. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "desktop", "error"],
      props: { state: "error" },
    },
    {
      slug: "opened",
      title: "Sign in to the Mokly app · Opened",
      description:
        "The grant handed to the app: Continue in the Mokly app, with Open Mokly alone, which reuses the same grant until it expires. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "desktop", "opened"],
      props: { state: "opened" },
    },
  ],
});
