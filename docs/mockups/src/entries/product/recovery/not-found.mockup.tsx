import { defineScreen } from "@mokly/mokly";

import {
  NotFoundEmptyScreen,
  NotFoundErrorScreen,
  NotFoundLoadingScreen,
  NotFoundScreen,
} from "../../../screens/product/recovery/not-found-screen";

/** The named screen component that each state draws. */
const screens = {
  default: NotFoundScreen,
  empty: NotFoundEmptyScreen,
  loading: NotFoundLoadingScreen,
  error: NotFoundErrorScreen,
};

export default defineScreen({
  title: "Page not found",
  description:
    "An unmatched product path offers one action to open the dashboard.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-navigation.md",
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
      title: "Page not found · Empty",
      description:
        "The unmatched route reads no product data, so this state repeats its canonical recovery.",
      tags: ["product", "folio", "recovery", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Page not found · Loading",
      description:
        "The unmatched route performs no read, so this state repeats its canonical recovery.",
      tags: ["product", "folio", "recovery", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Page not found · Error",
      description:
        "The unmatched route performs no read, so this state repeats its canonical recovery.",
      tags: ["product", "folio", "recovery", "error"],
      props: { state: "error" },
    },
  ],
});
