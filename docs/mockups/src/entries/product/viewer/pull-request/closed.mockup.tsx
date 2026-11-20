import { defineScreen } from "@mokly/mokly";

import {
  ViewerPullRequestClosedScreen,
  ViewerPullRequestMergedScreen,
} from "../../../../screens/product/viewer/pull-request-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerPullRequestClosedScreen,
  merged: ViewerPullRequestMergedScreen,
};

export default defineScreen({
  title: "Pull request · Closed",
  description:
    "Pull request — a closed pull request with nothing published. A closed pull request gets no new build, so the stage names its state and offers the switcher, never a way to publish it.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
  ],
  tags: ["product", "canvas", "viewer", "closed"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "merged"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "merged",
      title: "Pull request · Closed · Merged",
      description:
        "Pull request — a pull request from a fork, merged with nothing published; the stage says it was merged and offers the switcher.",
      tags: ["product", "canvas", "viewer", "merged"],
      props: { state: "merged" },
    },
  ],
});
