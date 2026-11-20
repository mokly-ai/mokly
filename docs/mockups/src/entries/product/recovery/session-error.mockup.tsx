import { defineScreen } from "@mokly/mokly";

import {
  SessionErrorEmptyScreen,
  SessionErrorErrorScreen,
  SessionErrorLoadingScreen,
  SessionErrorScreen,
} from "../../../screens/product/recovery/session-error-screen";

/** The named screen component that each state draws. */
const screens = {
  default: SessionErrorScreen,
  empty: SessionErrorEmptyScreen,
  loading: SessionErrorLoadingScreen,
  error: SessionErrorErrorScreen,
};

export default defineScreen({
  title: "Mokly couldn’t load",
  description:
    "A product route whose session read failed draws the account panel: its one heading names the failure, and the alert offers Try again with the request reference under Details.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/folio-chrome-account.md",
    "docs/protocol/cloud/web-app.md",
  ],
  tags: ["product", "folio", "recovery", "default"],
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
      title: "Mokly couldn’t load · Empty",
      description:
        "A session read answers with the session, a sign-out or a failure, never an empty result, so this state repeats its canonical recovery.",
      tags: ["product", "folio", "recovery", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Mokly couldn’t load · Loading",
      description:
        "While the session read runs, the route draws its destination's wait, and Try again keeps this screen until the read answers, so this state repeats its canonical recovery.",
      tags: ["product", "folio", "recovery", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Mokly couldn’t load · Error",
      description:
        "The canonical drawing is the failed session read, so this state repeats it.",
      tags: ["product", "folio", "recovery", "error"],
      props: { state: "error" },
    },
  ],
});
