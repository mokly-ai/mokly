import { defineScreen } from "@mokly/mokly";

import {
  ViewerStandalonePublishPullRequestScreen,
  ViewerStandalonePublishReaderScreen,
  ViewerStandalonePublishScreen,
  ViewerStandalonePublishingScreen,
  ViewerStandalonePullRequestReaderScreen,
} from "../../../../screens/product/viewer/publish-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerStandalonePublishScreen,
  "pull-request": ViewerStandalonePublishPullRequestScreen,
  reader: ViewerStandalonePublishReaderScreen,
  publishing: ViewerStandalonePublishingScreen,
  "reader-pull-request": ViewerStandalonePullRequestReaderScreen,
};

export default defineScreen({
  title: "Standalone · Publish",
  description:
    "Standalone — a branch with nothing published, in a project that can build: Publish this branch starts the build that publishes it, with the CI setup guide as the other way. The switcher's unpublished branch opens here.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
    "docs/protocol/cloud/viewer.md",
  ],
  tags: ["product", "folio", "viewer", "publish"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: {
        enum: [
          "default",
          "pull-request",
          "reader",
          "publishing",
          "reader-pull-request",
        ],
      },
    },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "pull-request",
      title: "Standalone · Publish · Pull request",
      description:
        "Standalone — a pull request with nothing published offers Publish this pull request, with the CI setup guide beside it.",
      tags: ["product", "folio", "viewer", "publish"],
      props: { state: "pull-request" },
    },
    {
      slug: "reader",
      title: "Standalone · Publish · Reviewer",
      description:
        "Standalone — the same branch read by a reviewer, who cannot request a build: the card says who can and offers the switcher.",
      tags: ["product", "folio", "viewer", "reader"],
      props: { state: "reader" },
    },
    {
      slug: "publishing",
      title: "Standalone · Publishing",
      description:
        "Standalone — a new project's default branch, whose first build runs in the stage until its publication is ready. Onboarding's Open project arrives here.",
      tags: ["product", "folio", "viewer", "publishing"],
      useCasePaths: ["flows/product-onboarding"],
      props: { state: "publishing" },
    },
    {
      slug: "reader-pull-request",
      title: "Standalone · Publish · Pull request reviewer",
      description:
        "Standalone — a pull request with nothing published, read by a reviewer, who cannot request a build: the card says who can publish it and offers the switcher.",
      tags: ["product", "folio", "viewer", "reader"],
      props: { state: "reader-pull-request" },
    },
  ],
});
