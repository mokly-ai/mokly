import { defineScreen } from "@mokly/mokly";

import {
  ViewerBuildEmptyScreen,
  ViewerBuildErrorScreen,
  ViewerBuildLoadingScreen,
  ViewerBuildPublishedScreen,
  ViewerBuildScreen,
} from "../../../../../screens/product/viewer/build-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerBuildScreen,
  empty: ViewerBuildEmptyScreen,
  loading: ViewerBuildLoadingScreen,
  error: ViewerBuildErrorScreen,
  published: ViewerBuildPublishedScreen,
};

export default defineScreen({
  title: "Build",
  description:
    "Build — one build's details in the stage: the branch and commit it publishes, its three steps with Install running, the live output with the runner's command lines quiet, and Cancel. History's Publishing row opens it.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
    "docs/protocol/cloud/cloud-build-runner.md",
  ],
  tags: ["product", "canvas", "viewer", "build"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: { enum: ["default", "empty", "loading", "error", "published"] },
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
      title: "Build · Empty",
      description:
        "Build — a requested build waiting to start: every step waits, there is no output yet, and Cancel stays.",
      tags: ["product", "canvas", "viewer", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Build · Loading",
      description:
        "Build — the chrome stays while the build is read, before anything names its branch, and the stage's waiting card names the read in its title.",
      tags: ["product", "canvas", "viewer", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Build · Error",
      description:
        "Build — an unknown build, one on another project or one the reader may not see; the switcher recovers.",
      tags: ["product", "canvas", "viewer", "error"],
      props: { state: "error" },
    },
    {
      slug: "published",
      title: "Build · Published",
      description:
        "Build — the build that published the branch's current publication: every step done, the output with a dropped stretch named where the log kept only its head and tail, and Open catalogue.",
      tags: ["product", "canvas", "viewer", "published"],
      props: { state: "published" },
    },
  ],
});
