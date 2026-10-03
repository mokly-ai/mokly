export const additions = [
  ["design-browse-details-screen", "screens/design-browse-details-screen.html"],
  ["design-browse-tag-picker", "screens/design-browse-tag-picker.html"],
  ["design-browse-tag-forms", "screens/design-browse-tag-forms.html"],
  ["design-browse-tag-onboarding", "screens/design-browse-tag-onboarding.html"],
  [
    "design-browse-tag-onboarding-picker",
    "screens/design-browse-tag-onboarding-picker.html",
  ],
] as const;

export const convertedVariants = [
  ["design-browse-dark-scheme", "dark-scheme"],
  ["design-browse-light-only", "light-only"],
  ["design-browse-tag-picker", "picker"],
  ["design-browse-tag-forms", "forms"],
  ["design-browse-tag-onboarding", "onboarding"],
  ["design-browse-tag-onboarding-picker", "onboarding-picker"],
] as const;

export const stylesheetEvidence = [
  [
    "design-review-style-matched",
    "screens/design-review-style-matched.html",
    "Changed styles that apply to this screen",
  ],
  [
    "design-review-style-unresolved",
    "screens/design-review-style-unresolved.html",
    "This change can apply anywhere on the screen, so the screen stays in Changes:",
  ],
  [
    "design-review-style-unnamed",
    "screens/design-review-style-unnamed.html",
    "This change can apply anywhere on the screen, so the screen stays in Changes.",
  ],
  [
    "design-review-style-excluded",
    "screens/design-review-style-excluded.html",
    "This stylesheet changed, but none of the changed styles apply to this screen",
  ],
] as const;

/** Each card names its stylesheet once and nests that file's outcomes. */
export const stylesheetCardGroups = [
  [
    "design-review-style-matched",
    [
      [
        "Changed styles that apply to this screen:",
        [".example-head", "main a"],
      ],
    ],
  ],
  [
    "design-review-style-unresolved",
    [
      [
        "This change can apply anywhere on the screen, so the screen stays in Changes:",
        [":root"],
      ],
    ],
  ],
  [
    "design-review-style-unnamed",
    [
      [
        "This change can apply anywhere on the screen, so the screen stays in Changes.",
        [],
      ],
    ],
  ],
  ["design-review-style-excluded", []],
] as const;

export const comparedStyleScreens = [
  "design-review-style-matched",
  "design-review-style-unresolved",
  "design-review-style-unnamed",
] as const;
