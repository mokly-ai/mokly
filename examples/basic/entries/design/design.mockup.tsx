import { collection, defineCollection, defineRoot } from "@mokly/mokly";

import { removedPageScreens } from "./browse/pages/previous-version/screens.js";
import { formsFilterScreen } from "./browse/states/tags/forms.js";
import { onboardingPickerScreen } from "./browse/states/tags/onboarding-picker.js";
import { onboardingFilterScreen } from "./browse/states/tags/onboarding.js";
import { tagPickerScreen } from "./browse/states/tags/picker.js";
import { variantScreens } from "./browse/variants/screens.js";
import { detailsScreen } from "./browse/views/details-screen.js";
import { browseSchemeScreens } from "./browse_scheme_screens.js";
import { browseStateScreens, browseViewScreens } from "./browse_screens.js";
import { browseTagScreens } from "./browse_tag_screens.js";
import { changesScreens } from "./changes_screens.js";
import { componentDesign } from "./components/index.js";
import { interactiveDesign } from "./interactive/index.js";
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
  children: [
    componentDesign,
    interactiveDesign,
    collection({
      children: [
        collection({
          children: [...browseViewScreens, detailsScreen],
          description:
            "Canonical Browse destinations: home, a screen, and a use case.",
          id: "design-browse-views",
          segment: "views",
          title: "Catalogue views",
        }),
        collection({
          children: [
            ...browseStateScreens,
            ...browseTagScreens,
            ...browseSchemeScreens,
            collection({
              children: [
                tagPickerScreen,
                formsFilterScreen,
                onboardingFilterScreen,
                onboardingPickerScreen,
              ],
              description: "Canonical Welcome tag selection and picker states.",
              id: "design-browse-tags",
              segment: "tags",
              title: "Tag states",
            }),
          ],
          description:
            "Browse states for details, missing routes, narrow layouts, tag filtering, and color schemes.",
          id: "design-browse-states",
          segment: "states",
          title: "Shell states",
        }),
        collection({
          children: variantScreens,
          description:
            "A screen's variants: one selected, one changed, one removed, and a change confined to other views.",
          id: "design-browse-variants",
          segment: "variants",
          title: "Screen variants",
        }),
        collection({
          children: [
            ...pageScreens,
            collection({
              children: removedPageScreens,
              description:
                "Previous-version states a removed document reaches before it can be read: a long document, the wait while it is retrieved, and a failure with Retry.",
              id: "design-browse-pages-previous",
              segment: "previous-version",
              title: "Previous document versions",
            }),
          ],
          description:
            "Complete documents, their details, and removed documents.",
          id: "design-browse-pages",
          segment: "pages",
          title: "Document pages",
        }),
        collection({
          children: publicationScreens,
          description:
            "Catalogue browsing with optional Changes and comparisons.",
          id: "design-browse-publication",
          segment: "publication",
          title: "Published catalogue",
        }),
      ],
      description:
        "The package-owned responsive Browse shell around consumer fragments.",
      id: "design-browse",
      segment: "browse",
      title: "Browse shell",
    }),
    collection({
      children: [
        collection({
          children: changesScreens,
          description: "Current and on-demand Overlay within the catalogue.",
          id: "design-changes-controls",
          segment: "controls",
          title: "Diff controls",
        }),
        collection({
          children: [
            ...reviewOutcomeScreens,
            collection({
              children: removedOutcomeScreens,
              description:
                "Previous-version states a removed screen reaches before it can be read: a long screen, the wait while it is retrieved, a failure with Retry, and a viewport with no previous view.",
              id: "design-review-outcomes-previous",
              segment: "previous-version",
              title: "Previous screen versions",
            }),
          ],
          description:
            "Per-screen comparison pages for each classification outcome, mode, and color scheme.",
          id: "design-review-outcomes",
          segment: "outcomes",
          title: "Comparison outcomes",
        }),
        collection({
          children: [
            ...reviewImpactScreens,
            collection({
              children: reviewStyleScreens,
              description:
                "Rule-aware stylesheet evidence: styles that apply, styles that could apply anywhere with and without names to list, and a stylesheet examined and excluded.",
              id: "design-review-stylesheets",
              segment: "stylesheets",
              title: "Stylesheet evidence",
            }),
          ],
          description:
            "Aggregate review states: shared impact, ignored regions, empty.",
          id: "design-review-impact",
          segment: "impact",
          title: "Impact states",
        }),
        collection({
          children: reviewAvailabilityScreens,
          description:
            "Changes while the comparison is being prepared and after preparing it fails.",
          id: "design-review-availability",
          segment: "availability",
          title: "Comparison availability",
        }),
      ],
      dependencies: [
        ...DESIGN_DEPENDENCIES,
        "examples/basic/generated/design-review.css",
      ],
      description:
        "Optional screen comparisons within the catalogue Changes filter.",
      id: "design-review",
      segment: "review",
      title: "Changes",
    }),
  ],
  collection: {
    dependencies: DESIGN_DEPENDENCIES,
    description:
      "Neutral design mockups for the Mokly shell implemented in the UI milestone.",
    id: "design",
    rationale:
      "Reviewers approve the complete catalogue and Changes design from synthetic data before any shell UI is implemented.",
    relatedDocs: [
      "docs/protocol/mokly-shell-design.md",
      "examples/basic/notes.md",
    ],
    title: "Mokly design",
  },
  path: "design",
});

/** The neutral Mokly catalogue and Changes design catalogue. */
export const mockups = [
  defineCollection({
    childIds: ["design", "design-library"],
    dependencies: DESIGN_DEPENDENCIES,
    description: "Neutral design references for the Mokly package.",
    id: "design-root",
    relatedDocs: ["docs/protocol/mokly-shell-design.md"],
    title: "Design",
  }),
  ...designMockups,
];
