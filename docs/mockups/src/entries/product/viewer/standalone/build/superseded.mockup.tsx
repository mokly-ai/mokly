import { defineScreen } from "@mokly/mokly";

import {
  ViewerBuildCancelledScreen,
  ViewerBuildSupersededScreen,
} from "../../../../../screens/product/viewer/build-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerBuildSupersededScreen,
  cancelled: ViewerBuildCancelledScreen,
};

export default defineScreen({
  title: "Build · Superseded",
  description:
    "Build — a newer push on the same branch replaced this build while it installed; the step it stopped in is marked and Open the newer build leads to the one that replaced it.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
  ],
  tags: ["product", "folio", "viewer", "superseded"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "cancelled"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "cancelled",
      title: "Build · Superseded · Cancelled",
      description:
        "Build — a member cancelled this build while it fetched; Try again requests a new build for the branch.",
      tags: ["product", "folio", "viewer", "cancelled"],
      props: { state: "cancelled" },
    },
  ],
});
