import { defineScreen } from "@mokly/mokly";

import {
  ViewerPullRequestPlanReaderScreen,
  ViewerPullRequestPlanScreen,
} from "../../../../screens/product/viewer/pull-request-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerPullRequestPlanScreen,
  reader: ViewerPullRequestPlanReaderScreen,
};

export default defineScreen({
  title: "Pull request · Private on the free plan",
  description:
    "Pull request — an open pull request in a private project on the free plan, with nothing published. The plan takes no new publication, so the alias shows the Team card a branch shows: an owner is offered Billing, with the switcher beside it.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
  ],
  tags: ["product", "folio", "viewer", "plan"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "reader"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "reader",
      title: "Pull request · Private on the free plan · Reader",
      description:
        "Pull request — the same pull request read by someone who cannot open billing: the card says what they can do instead and offers the switcher.",
      tags: ["product", "folio", "viewer", "plan-reader"],
      props: { state: "reader" },
    },
  ],
});
