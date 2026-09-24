import { folder, defineRoot } from "@mokly/mokly";

import { appearanceDesign } from "./browse/appearance/index.js";
import { removedPageScreens } from "./browse/pages/previous-version/screens.js";
import { variantScreens } from "./browse/variants/screens.js";
import { detailsScreen } from "./browse/views/details-screen.js";
import { browseStateScreens, browseViewScreens } from "./browse_screens.js";
import { browseTagScreens } from "./browse_tag_screens.js";
import { changesScreens } from "./changes_screens.js";
import { componentDesign } from "./components/index.js";
import { pageScreens } from "./page_screens.js";
import { publicationScreens } from "./publication_screens.js";
import { removedOutcomeScreens } from "./review/outcomes/previous-version/screens.js";
import { reviewAvailabilityScreens } from "./review_availability_screens.js";
import { reviewImpactScreens } from "./review_impact_screens.js";
import { reviewOutcomeScreens } from "./review_outcome_screens.js";
import { reviewStyleScreens } from "./review_style_screens.js";

const DESIGN_DEPENDENCIES = [
  "examples/basic/generated/design-stage.css",
  "examples/basic/generated/design.css",
];

const designMockups = defineRoot({
  navPath: ["Design", "Mokly design"],
  children: [
    componentDesign,
    folder({
      children: [
        folder({
          children: [...browseViewScreens, detailsScreen],
          segment: "views",
          title: "Catalogue views",
        }),
        folder({
          children: [...browseStateScreens, ...browseTagScreens],
          segment: "states",
          title: "Shell states",
        }),
        folder({
          children: variantScreens,
          segment: "variants",
          title: "Screen variants",
        }),
        folder({
          children: [
            ...pageScreens,
            folder({
              children: removedPageScreens,
              segment: "previous-version",
              title: "Previous document versions",
            }),
          ],
          segment: "pages",
          title: "Document pages",
        }),
        folder({
          children: publicationScreens,
          segment: "publication",
          title: "Published catalogue",
        }),
        appearanceDesign,
      ],
      segment: "browse",
      title: "Browse shell",
    }),
    folder({
      children: [
        folder({
          children: changesScreens,
          segment: "controls",
          title: "Diff controls",
        }),
        folder({
          children: [
            ...reviewOutcomeScreens,
            folder({
              children: removedOutcomeScreens,
              segment: "previous-version",
              title: "Previous screen versions",
            }),
          ],
          segment: "outcomes",
          title: "Comparison outcomes",
        }),
        folder({
          children: [
            ...reviewImpactScreens,
            folder({
              children: reviewStyleScreens,
              segment: "stylesheets",
              title: "Stylesheet evidence",
            }),
          ],
          segment: "impact",
          title: "Impact states",
        }),
        folder({
          children: reviewAvailabilityScreens,
          segment: "availability",
          title: "Comparison availability",
        }),
      ],
      dependencies: [
        ...DESIGN_DEPENDENCIES,
        "examples/basic/generated/design-review.css",
      ],
      segment: "review",
      title: "Changes",
    }),
  ],
  dependencies: DESIGN_DEPENDENCIES,
  relatedDocs: [
    "docs/protocol/mokly-shell-design.md",
    "examples/basic/notes.md",
  ],
  path: "design",
});

/** The neutral Mokly catalogue and Changes design catalogue. */
export const mockups = designMockups;
