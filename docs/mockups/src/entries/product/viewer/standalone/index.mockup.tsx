import { defineScreen } from "@mokly/mokly";

import {
  ViewerStandaloneEmptyScreen,
  ViewerStandaloneErrorScreen,
  ViewerStandaloneLoadingScreen,
  ViewerStandaloneScreen,
} from "../../../../screens/product/viewer/standalone-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerStandaloneScreen,
  empty: ViewerStandaloneEmptyScreen,
  loading: ViewerStandaloneLoadingScreen,
  error: ViewerStandaloneErrorScreen,
};

export default defineScreen({
  title: "Standalone",
  description: "Standalone — a ready publication for the selected branch.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
  ],
  tags: ["product", "folio", "viewer", "default"],
  useCasePaths: ["flows/product-browse"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "empty", "loading", "error"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "empty",
      title: "Standalone · Empty",
      description:
        "Standalone — the branch has no publication in a project that cannot build, so the stage offers Set up publishing.",
      tags: ["product", "folio", "viewer", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Standalone · Loading",
      description:
        "Standalone — a branch alias's own read: the chrome stays and names the branch while the publication loads, and the stage's waiting card names the read in its title.",
      tags: ["product", "folio", "viewer", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Standalone · Error",
      description:
        "Standalone — the publication is unavailable and the switcher recovers it.",
      tags: ["product", "folio", "viewer", "error"],
      props: { state: "error" },
    },
  ],
});
