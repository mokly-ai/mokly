export const additions = [
  [
    "design/browse/views/details-screen",
    "design/browse/views/details-screen/index.html",
  ],
  [
    "design/browse/views/screen/tag-picker",
    "design/browse/views/screen/tag-picker/index.html",
  ],
  [
    "design/browse/views/screen/tag-forms",
    "design/browse/views/screen/tag-forms/index.html",
  ],
  [
    "design/browse/views/screen/tag-onboarding",
    "design/browse/views/screen/tag-onboarding/index.html",
  ],
  [
    "design/browse/views/screen/tag-onboarding-picker",
    "design/browse/views/screen/tag-onboarding-picker/index.html",
  ],
] as const;

export const convertedVariants = [
  ["design/browse/views/screen/dark-scheme", "dark-scheme"],
  ["design/browse/views/screen/light-only", "light-only"],
  ["design/browse/views/screen/tag-picker", "picker"],
  ["design/browse/views/screen/tag-forms", "forms"],
  ["design/browse/views/screen/tag-onboarding", "onboarding"],
  ["design/browse/views/screen/tag-onboarding-picker", "onboarding-picker"],
] as const;

export const stylesheetEvidence = [
  [
    "design/changes/impact/styles/matched-excluded/matched",
    "design/changes/impact/styles/matched-excluded/matched/index.html",
    "Changed styles that apply to this screen",
  ],
  [
    "design/changes/impact/styles/unresolved-unnamed/unresolved",
    "design/changes/impact/styles/unresolved-unnamed/unresolved/index.html",
    "This change can apply anywhere on the screen, so the screen stays in Changes:",
  ],
  [
    "design/changes/impact/styles/unresolved-unnamed/unnamed",
    "design/changes/impact/styles/unresolved-unnamed/unnamed/index.html",
    "This change can apply anywhere on the screen, so the screen stays in Changes.",
  ],
  [
    "design/changes/impact/styles/matched-excluded/excluded",
    "design/changes/impact/styles/matched-excluded/excluded/index.html",
    "This stylesheet changed, but none of the changed styles apply to this screen",
  ],
] as const;

/** The matched outcome that Excluded and Matched share in one Details card. */
const welcomeMatched = [
  ["Changed styles that apply to this screen:", [".example-head", "main a"]],
] as const;

/** Each card names its stylesheet once and nests that file's outcomes. */
export const stylesheetCardGroups = [
  ["design/changes/impact/styles/matched-excluded/matched", welcomeMatched],
  [
    "design/changes/impact/styles/unresolved-unnamed/unresolved",
    [
      [
        "This change can apply anywhere on the screen, so the screen stays in Changes:",
        [":root"],
      ],
    ],
  ],
  [
    "design/changes/impact/styles/unresolved-unnamed/unnamed",
    [
      [
        "This change can apply anywhere on the screen, so the screen stays in Changes.",
        [],
      ],
    ],
  ],
  ["design/changes/impact/styles/matched-excluded/excluded", welcomeMatched],
] as const;

export const comparedStyleScreens = [
  "design/changes/impact/styles/matched-excluded/matched",
  "design/changes/impact/styles/unresolved-unnamed/unresolved",
  "design/changes/impact/styles/unresolved-unnamed/unnamed",
] as const;
