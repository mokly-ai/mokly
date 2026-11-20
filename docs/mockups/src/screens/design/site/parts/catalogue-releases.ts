import type { Release } from "./release";

export const catalogueReleases = [
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.14.0...v0.15.0",
    date: "2026-10-12",
    groups: [
      {
        title: "Breaking changes",
        notes: [
          "Entry dependencies, component ownedDependencies and review.sharedImpact have no effect.",
          "Generated output uses manifest v10, catalogue read model v6 and review result v7.",
          "Rename ManifestV9, ReviewResultV6 and ScreenReviewV6 to ManifestV10, ReviewResultV7 and ScreenReviewV7.",
        ],
      },
      {
        title: "Features",
        notes: [
          "Classify each changed CSS rule by the elements that it matches",
          "Declare component CSS with the stylesheets field",
        ],
      },
      {
        title: "Bug fixes",
        notes: [
          "Ignore foreign links, keep snapshot forms, remove wording tests",
          "Keep authored files readable across reloads and restarts",
        ],
      },
      {
        title: "Dependencies",
        notes: ["@mokly/viewer bumped from 0.5.0 to 0.6.0"],
      },
    ],
    id: "release-0-15-0",
    readableDate: "12 October 2026",
    version: "0.15.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.13.0...v0.14.0",
    date: "2026-10-08",
    groups: [
      {
        title: "Breaking changes",
        notes: [
          "Mokly publish now requires a clean checkout.",
          "File-path identity and Markdown documents",
        ],
      },
      {
        title: "Features",
        notes: [
          "Make .mokly-cache ignore itself",
          "Simplify generated output and delivery",
          "Tier MockLink asChild placement and add build warnings",
          "Add route-scoped shell bootstraps",
        ],
      },
      {
        title: "Dependencies",
        notes: ["@mokly/viewer bumped from 0.4.0 to 0.5.0"],
      },
    ],
    id: "release-0-14-0",
    readableDate: "8 October 2026",
    version: "0.14.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.12.0...v0.13.0",
    date: "2026-09-30",
    groups: [
      {
        notes: [
          "Publish runs the plan, blob and complete upload exchange",
          "Place entries in navPath folders in place of collections",
        ],
        title: "Breaking changes",
      },
      {
        notes: [
          "Add co-located entries and screen variants",
          "Upload catalogue content deltas",
          "Replace collections with navigation paths",
          "Add Auto, Light and Dark appearance",
          "Align comparison pane scrolling",
        ],
        title: "Features",
      },
      {
        notes: [
          "Align screen variants and history",
          "Complete the entry discovery follow-up",
          "Resolve effective views",
        ],
        title: "Bug fixes",
      },
      {
        notes: ["Bump @mokly/viewer from 0.3.0 to 0.4.0"],
        title: "Dependencies",
      },
    ],
    id: "release-0-13-0",
    readableDate: "30 September 2026",
    version: "0.13.0",
  },
] as const satisfies readonly Release[];
