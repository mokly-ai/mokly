import { defineScreen } from "@mokly/mokly";

import {
  ViewerPublishRefusedPullRequestScreen,
  ViewerPublishRefusedScreen,
} from "../../../../screens/product/viewer/publish-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerPublishRefusedScreen,
  "pull-request": ViewerPublishRefusedPullRequestScreen,
};

export default defineScreen({
  title: "Standalone · Publish · Refused",
  description:
    "Standalone — Publish this branch was refused while Mokly was busy: the refusal stands above Try again, Publish from CI stays beside the control, and the request's reference sits in Details beneath both.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
  ],
  tags: ["product", "folio", "viewer", "refused"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "pull-request"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "pull-request",
      title: "Standalone · Publish · Refused · Pull request",
      description:
        "Standalone — Publish this pull request was refused because the project no longer builds. The control keeps its label, because pressing it again would be refused again, and Publish from CI beside it moves beneath it on a narrow screen, still above Details.",
      tags: ["product", "folio", "viewer", "refused"],
      props: { state: "pull-request" },
    },
  ],
});
