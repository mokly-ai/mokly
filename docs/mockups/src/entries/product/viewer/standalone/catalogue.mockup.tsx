import { defineScreen } from "@mokly/mokly";

import {
  ViewerStandaloneCatalogueErrorScreen,
  ViewerStandaloneCatalogueLoadingScreen,
  ViewerStandaloneCatalogueScreen,
  ViewerStandaloneComparisonScreen,
} from "../../../../screens/product/viewer/standalone-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerStandaloneCatalogueScreen,
  loading: ViewerStandaloneCatalogueLoadingScreen,
  error: ViewerStandaloneCatalogueErrorScreen,
  comparison: ViewerStandaloneComparisonScreen,
};

export default defineScreen({
  title: "Standalone · Catalogue",
  description:
    "Standalone — the browser keeps every credential of the publication\u2019s host out of this page, so the stage\u2019s final card offers no action and names the browsers that open the publication on a computer.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
  ],
  tags: ["product", "canvas", "viewer", "catalogue"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: { enum: ["default", "loading", "error", "comparison"] },
    },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "loading",
      title: "Standalone · Catalogue · Loading",
      description:
        "Standalone — the publication\u2019s own host is exchanging the reader\u2019s grant for its cookie, which it needs before the catalogue can mount. The stage's waiting card names the exchange in its title.",
      tags: ["product", "canvas", "viewer", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Standalone · Catalogue · Error",
      description:
        "Standalone — the publication\u2019s host refused the reader\u2019s credential, which another press can still fix.",
      tags: ["product", "canvas", "viewer", "error"],
      props: { state: "error" },
    },
    {
      slug: "comparison",
      title: "Standalone · Catalogue · Comparison",
      description:
        "Standalone — a private comparison the published viewer cannot authenticate in-page covers the shown preview with the stage\u2019s blocked-access card, which offers no action.",
      tags: ["product", "canvas", "viewer", "error"],
      props: { state: "comparison" },
    },
  ],
});
