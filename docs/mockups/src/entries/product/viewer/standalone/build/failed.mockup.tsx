import { defineScreen } from "@mokly/mokly";

import {
  ViewerBuildFailedScreen,
  ViewerBuildInfrastructureScreen,
  ViewerBuildPlanScreen,
  ViewerBuildTimedOutScreen,
  ViewerBuildVersionScreen,
} from "../../../../../screens/product/viewer/build-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerBuildFailedScreen,
  "timed-out": ViewerBuildTimedOutScreen,
  infrastructure: ViewerBuildInfrastructureScreen,
  plan: ViewerBuildPlanScreen,
  version: ViewerBuildVersionScreen,
};

export default defineScreen({
  title: "Build · Failed",
  description:
    "Build — a build whose install failed: the cause's one sentence, the failed step marked, the output's tail with npm's own error, and Try again. History's failed build row opens it.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
    "docs/protocol/cloud/product-copy.md",
  ],
  tags: ["product", "canvas", "viewer", "failed"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: {
        enum: ["default", "timed-out", "infrastructure", "plan", "version"],
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
      slug: "timed-out",
      title: "Build · Failed · Timed out",
      description:
        "Build — a pull request's build whose publish ran into the fifteen-minute limit; the runner's own line says where it stopped.",
      tags: ["product", "canvas", "viewer", "timed-out"],
      props: { state: "timed-out" },
    },
    {
      slug: "infrastructure",
      title: "Build · Failed · Couldn’t run",
      description:
        "Build — a build Mokly could not run after every retry, here because GitHub kept answering the fetch with a server error.",
      tags: ["product", "canvas", "viewer", "infrastructure"],
      props: { state: "infrastructure" },
    },
    {
      slug: "plan",
      title: "Build · Failed · Plan",
      description:
        "Build — a private project's build claimed after the workspace returned to Free: the Team card's copy with Open billing for the owner, and no step run.",
      tags: ["product", "canvas", "viewer", "plan"],
      props: { state: "plan" },
    },
    {
      slug: "version",
      title: "Build · Failed · Version",
      description:
        "Build — a branch that installs a CLI older than builds accept, stopped before it exports; the output shows the version the repository installed.",
      tags: ["product", "canvas", "viewer", "version"],
      props: { state: "version" },
    },
  ],
});
