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
  "examples/basic/design-stage.css",
  "examples/basic/design.css",
];

const designMockups = defineRoot({
  navPath: ["Design", "Mokly design"],
  children: [
    componentDesign,
    folder({
      children: [
        folder({
          children: [...browseViewScreens, detailsScreen],
          title: "Catalogue views",
        }),
        folder({
          children: [...browseStateScreens, ...browseTagScreens],
          title: "Shell states",
        }),
        folder({
          children: variantScreens,
          title: "Screen variants",
        }),
        folder({
          children: [
            ...pageScreens,
            folder({
              children: removedPageScreens,
              title: "Previous document versions",
            }),
          ],
          title: "Document pages",
        }),
        folder({
          children: publicationScreens,
          title: "Published catalogue",
        }),
        appearanceDesign,
      ],
      title: "Browse shell",
    }),
    folder({
      children: [
        folder({
          children: changesScreens,
          title: "Diff controls",
        }),
        folder({
          children: [
            ...reviewOutcomeScreens,
            folder({
              children: removedOutcomeScreens,
              title: "Previous screen versions",
            }),
          ],
          title: "Comparison outcomes",
        }),
        folder({
          children: [
            ...reviewImpactScreens,
            folder({
              children: reviewStyleScreens,
              title: "Stylesheet evidence",
            }),
          ],
          title: "Impact states",
        }),
        folder({
          children: reviewAvailabilityScreens,
          title: "Comparison availability",
        }),
      ],
      dependencies: [
        ...DESIGN_DEPENDENCIES,
        "examples/basic/design-review.css",
      ],
      title: "Changes",
    }),
  ],
  dependencies: DESIGN_DEPENDENCIES,
  relatedDocs: [
    "docs/protocol/mokly-shell-design.md",
    "examples/basic/notes.md",
  ],
});

/** The neutral Mokly catalogue and Changes design catalogue. */
export const mockups = designMockups;
