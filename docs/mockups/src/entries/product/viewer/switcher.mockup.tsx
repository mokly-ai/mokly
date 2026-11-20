import { defineScreen } from "@mokly/mokly";

import {
  ViewerSwitcherEmptyScreen,
  ViewerSwitcherErrorScreen,
  ViewerSwitcherLoadingScreen,
  ViewerSwitcherNoBranchesScreen,
  ViewerSwitcherScreen,
} from "../../../screens/product/viewer/switcher-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerSwitcherScreen,
  empty: ViewerSwitcherEmptyScreen,
  loading: ViewerSwitcherLoadingScreen,
  error: ViewerSwitcherErrorScreen,
  "no-branches": ViewerSwitcherNoBranchesScreen,
};

export default defineScreen({
  title: "Switcher",
  description:
    "Switcher — branches with the default first, then pull requests. A row's state and commit are the newer of its newest publication and its newest build, and a row with a ready publication still opens it: the branch Cal reads says Publishing now while a build publishes a newer push, and Alex's alex/onboarding-copy says Unable to publish because its newest publication failed. Every reference opens, because its address resolves whether or not anything is ready: a pull request whose first build runs opens that build, and a branch with nothing published offers to publish it. A reference with nothing ready whose newest attempt failed offers its details instead, because there is no catalogue behind it: a failed publication opens its own details, and a failed build opens that build.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/viewer-read-model.md",
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/viewer-build-navigation.md",
  ],
  tags: ["product", "folio", "viewer", "default"],
  useCasePaths: ["flows/product-browse"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: { enum: ["default", "empty", "loading", "error", "no-branches"] },
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
      title: "Switcher · Empty",
      description: "Switcher — a search that matches no reference.",
      relatedDocs: [
        "docs/protocol/cloud/product-mockups.md",
        "docs/protocol/cloud/viewer.md",
      ],
      tags: ["product", "folio", "viewer", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Switcher · Loading",
      description:
        "Switcher — the references load over the viewer: the search is disabled, and each group draws one placeholder row under a bar, because only a group with references shows its label.",
      relatedDocs: [
        "docs/protocol/cloud/product-mockups.md",
        "docs/protocol/cloud/viewer.md",
      ],
      tags: ["product", "folio", "viewer", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Switcher · Error",
      description:
        "Switcher — the references could not load and offer one retry.",
      relatedDocs: [
        "docs/protocol/cloud/product-mockups.md",
        "docs/protocol/cloud/viewer.md",
      ],
      tags: ["product", "folio", "viewer", "error"],
      props: { state: "error" },
    },
    {
      slug: "no-branches",
      title: "Switcher · No branches yet",
      description:
        "Switcher — a project Mokly has not observed a repository for has no branches and no pull requests, which is the state every reader is in during onboarding. It is not the empty search beside it: only one of the two has a search to clear. Setting publishing up is an administrator's action, so only an administrator is offered it.",
      relatedDocs: [
        "docs/protocol/cloud/product-mockups.md",
        "docs/protocol/cloud/viewer.md",
      ],
      tags: ["product", "folio", "viewer", "no-branches"],
      props: { state: "no-branches" },
    },
  ],
});
