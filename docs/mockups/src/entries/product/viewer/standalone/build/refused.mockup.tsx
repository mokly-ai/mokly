import { defineScreen } from "@mokly/mokly";

import {
  ViewerBuildCancelRefusedScreen,
  ViewerBuildRefusedScreen,
} from "../../../../../screens/product/viewer/build-refusal-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerBuildRefusedScreen,
  cancel: ViewerBuildCancelRefusedScreen,
};

export default defineScreen({
  title: "Build · Refused",
  description:
    "Build — a pull request closed after its install failed. Try again was refused: the refusal stands above the control, which keeps its label, with the request's reference in Details beneath. A pull request from a fork is refused the same way, with its own sentence.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
  ],
  tags: ["product", "canvas", "viewer", "refused"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "cancel"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "cancel",
      title: "Build · Refused · Cancel",
      description:
        "Build — a running build whose Cancel was refused while Mokly was busy. The refusal stands above the control, which still reads Cancel, because Try again on a build card requests a new build; the request's reference is in Details beneath.",
      relatedDocs: [
        "docs/protocol/cloud/viewer-builds.md",
        "docs/protocol/cloud/folio-chrome.md",
        "docs/protocol/cloud/product-mockups-viewer.md",
      ],
      tags: ["product", "canvas", "viewer", "cancel"],
      props: { state: "cancel" },
    },
  ],
});
