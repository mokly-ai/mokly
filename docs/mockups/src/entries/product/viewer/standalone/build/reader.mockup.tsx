import { defineScreen } from "@mokly/mokly";

import {
  ViewerBuildReaderPlanLoadingScreen,
  ViewerBuildReaderPlanScreen,
  ViewerBuildReaderQueuedScreen,
  ViewerBuildReaderRunningScreen,
  ViewerBuildReaderScreen,
} from "../../../../../screens/product/viewer/build-reader-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerBuildReaderScreen,
  plan: ViewerBuildReaderPlanScreen,
  "plan-loading": ViewerBuildReaderPlanLoadingScreen,
  queued: ViewerBuildReaderQueuedScreen,
  running: ViewerBuildReaderRunningScreen,
};

export default defineScreen({
  title: "Build · Reader",
  description:
    "Build — the failed install read by a reviewer, who cannot request builds: the cause's sentence, the output's tail and no action.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/viewer-chrome.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
  ],
  tags: ["product", "folio", "viewer", "reader"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: {
        enum: ["default", "plan", "plan-loading", "queued", "running"],
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
      slug: "plan",
      title: "Build · Reader · Plan",
      description:
        "Build — the plan refusal read by an administrator who is not an owner: the Team card's title, the line that says who can upgrade, and no action.",
      tags: ["product", "folio", "viewer", "plan"],
      props: { state: "plan" },
    },
    {
      slug: "plan-loading",
      title: "Build · Reader · Plan loading",
      description:
        "Build — the same refusal while the workspace read decides whether the reader can open Billing: the title, and the owner's action as a placeholder, with no line, because an owner's card has none. Screen readers hear the read.",
      tags: ["product", "folio", "viewer", "plan"],
      props: { state: "plan-loading" },
    },
    {
      slug: "queued",
      title: "Build · Reader · Queued",
      description:
        "Build — a requested build waiting to start, read by a reviewer, who cannot cancel builds: every step waits, there is no output yet, and the card offers no action.",
      tags: ["product", "folio", "viewer", "queued"],
      props: { state: "queued" },
    },
    {
      slug: "running",
      title: "Build · Reader · Running",
      description:
        "Build — a build running on a newer push, read by a reviewer, who cannot cancel builds: its steps and its live output, with no line and no action.",
      tags: ["product", "folio", "viewer", "running"],
      props: { state: "running" },
    },
  ],
});
