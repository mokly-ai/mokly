import { defineScreen } from "@mokly/mokly";

import {
  ViewerShareCatalogueScreen,
  ViewerShareEmptyScreen,
  ViewerShareErrorScreen,
  ViewerShareLoadingScreen,
  ViewerShareScreen,
} from "../../../screens/product/viewer/share-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerShareScreen,
  empty: ViewerShareEmptyScreen,
  loading: ViewerShareLoadingScreen,
  error: ViewerShareErrorScreen,
  catalogue: ViewerShareCatalogueScreen,
};

export default defineScreen({
  title: "Share",
  description:
    "Share — the canonical link, the access it grants, and the screen it points at. Screen selection belongs to the package, which has not shipped, so the choice is this publication's own current screens, narrowed to the ones it draws at the selected viewport and scheme.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/viewer-read-model.md",
  ],
  tags: ["product", "canvas", "viewer", "default"],
  useCasePaths: ["flows/product-browse"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: { enum: ["default", "empty", "loading", "error", "catalogue"] },
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
      title: "Share · Empty",
      description:
        "Share — nothing is published on this branch to link to yet.",
      relatedDocs: [
        "docs/protocol/cloud/product-mockups.md",
        "docs/protocol/cloud/viewer.md",
      ],
      tags: ["product", "canvas", "viewer", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Share · Loading",
      description:
        "Share — the link is prepared over the viewer: the link's field names the read, Copy link is disabled, and the screens list draws one placeholder row while it loads.",
      relatedDocs: [
        "docs/protocol/cloud/product-mockups.md",
        "docs/protocol/cloud/viewer.md",
      ],
      tags: ["product", "canvas", "viewer", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Share · Error",
      description:
        "Share — the link could not be prepared and offers one retry.",
      relatedDocs: [
        "docs/protocol/cloud/product-mockups.md",
        "docs/protocol/cloud/viewer.md",
      ],
      tags: ["product", "canvas", "viewer", "error"],
      props: { state: "error" },
    },
    {
      slug: "catalogue",
      title: "Share · Whole catalogue",
      description:
        "Share — a publication with nothing to compare has no screens of its own, so the link points at the whole catalogue and no screen choice is offered.",
      tags: ["product", "canvas", "viewer", "catalogue"],
      props: { state: "catalogue" },
    },
  ],
});
