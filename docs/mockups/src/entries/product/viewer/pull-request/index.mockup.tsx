import { defineScreen } from "@mokly/mokly";

import {
  ViewerPullRequestEmptyScreen,
  ViewerPullRequestErrorScreen,
  ViewerPullRequestLoadingScreen,
  ViewerPullRequestPublishingScreen,
  ViewerPullRequestScreen,
} from "../../../../screens/product/viewer/pull-request-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerPullRequestScreen,
  empty: ViewerPullRequestEmptyScreen,
  loading: ViewerPullRequestLoadingScreen,
  error: ViewerPullRequestErrorScreen,
  publishing: ViewerPullRequestPublishingScreen,
};

export default defineScreen({
  title: "Pull request",
  description:
    "Pull request — the check link's publication, with Changes preselected. The right panel's Changes tab holds the cloud's Mokly check, which says it succeeded, gives its changed, added and removed counts, and links the pull request's checks on GitHub. The phone keeps the panel's sheet closed.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
  ],
  tags: ["product", "canvas", "viewer", "default"],
  useCasePaths: ["flows/product-browse"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: { enum: ["default", "empty", "loading", "error", "publishing"] },
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
      title: "Pull request · Empty",
      description:
        "Pull request — the check has not published a catalogue yet.",
      tags: ["product", "canvas", "viewer", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Pull request · Loading",
      description:
        "Pull request — the chrome stays while the publication loads, and the stage's waiting card names the read in its title.",
      tags: ["product", "canvas", "viewer", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Pull request · Error",
      description:
        "Pull request — the publication is unavailable and the switcher recovers it.",
      tags: ["product", "canvas", "viewer", "error"],
      props: { state: "error" },
    },
    {
      slug: "publishing",
      title: "Pull request · Publishing",
      description:
        "Pull request — nothing is ready yet and its first build runs, so the alias shows that build until the publication arrives. The switcher's publishing pull request opens here.",
      relatedDocs: [
        "docs/protocol/cloud/viewer-builds.md",
        "docs/protocol/cloud/product-mockups-viewer.md",
        "docs/protocol/cloud/viewer.md",
      ],
      tags: ["product", "canvas", "viewer", "publishing"],
      props: { state: "publishing" },
    },
  ],
});
