import { defineScreen } from "@mokly/mokly";

import {
  ViewerHistoryEmptyScreen,
  ViewerHistoryErrorScreen,
  ViewerHistoryLoadingScreen,
  ViewerHistoryScreen,
} from "../../../screens/product/viewer/history-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerHistoryScreen,
  empty: ViewerHistoryEmptyScreen,
  loading: ViewerHistoryLoadingScreen,
  error: ViewerHistoryErrorScreen,
};

export default defineScreen({
  title: "History",
  description:
    "History — the branch's publications and builds, newest first: a build publishing a newer push and a build that failed sit among the publications, read as Publishing now and Unable to publish, and each opens its own details.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/viewer-builds.md",
  ],
  tags: ["product", "canvas", "viewer", "default"],
  useCasePaths: ["flows/product-browse"],
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
      title: "History · Empty",
      description:
        "History — the branch has published once, so there is nothing earlier.",
      tags: ["product", "canvas", "viewer", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "History · Loading",
      description:
        "History — the publications load over the viewer: the list draws one placeholder row.",
      tags: ["product", "canvas", "viewer", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "History · Error",
      description:
        "History — the publications could not load and offer one retry.",
      tags: ["product", "canvas", "viewer", "error"],
      props: { state: "error" },
    },
  ],
});
