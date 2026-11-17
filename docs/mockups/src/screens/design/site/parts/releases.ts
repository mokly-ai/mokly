/**
 * Release facts depicted on the changelog. Every version, date,
 * note and compare link is taken from the installed package's `CHANGELOG.md` at
 * the time of authoring; the mockup never states a release fact of its own.
 */

/** One group of notes inside a release, such as Features or Bug fixes. */
export interface ReleaseGroup {
  notes: readonly string[];
  title: string;
}

/** One published release of the Mokly CLI. */
export interface Release {
  compare: string;
  date: string;
  groups: readonly ReleaseGroup[];
  id: string;
  readableDate: string;
  version: string;
}

/** Every depicted release, newest first. */
export const RELEASES: readonly Release[] = [
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.17.0...v0.18.0",
    date: "2026-11-01",
    groups: [
      {
        title: "Breaking changes",
        notes: [
          "The catalogue index is version 9 and the entry detail is version 4.",
        ],
      },
      {
        title: "Features",
        notes: [
          "Show comparison steps while Changes loads",
          "Give entry details content ids and add a deployment file",
          "Move the controls to @mokly/ui",
          "Move the inspector to @mokly/ui",
          "Move the layout and theme to @mokly/ui",
        ],
      },
      {
        title: "Bug fixes",
        notes: ["Carry unchanged public closures across replacements"],
      },
      {
        title: "Performance",
        notes: ["Reuse stylesheet bundles with shared module evidence"],
      },
    ],
    id: "release-0-18-0",
    readableDate: "1 November 2026",
    version: "0.18.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.16.1...v0.17.0",
    date: "2026-10-29",
    groups: [
      {
        title: "Breaking changes",
        notes: [
          "Keep a component's usage lists in its parent detail",
          "Catalogue index v8 and upload envelope v3.",
        ],
      },
      {
        title: "Features",
        notes: [
          "Send gzip Blob bodies when the receiver lists gzip",
          "Remove review.json; compare from the index and entry details",
          "Add the @mokly/ui shared UI package",
          "Warn on stylesheet renderer seeds and align the docs",
        ],
      },
      {
        title: "Bug fixes",
        notes: [
          "Give config-relative paths one normalized form",
          "Align CSS Modules scanners with cssparser",
          "Read unreadable extraction files through Git",
          "Key unattributed definitions and unnamed previews exactly",
          "Report closure warnings in Serve and previews",
        ],
      },
      {
        title: "Performance",
        notes: [
          "Capture head documents once during the build check",
          "Read base files from the leased extraction",
        ],
      },
    ],
    id: "release-0-17-0",
    readableDate: "29 October 2026",
    version: "0.17.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.16.0...v0.16.1",
    date: "2026-10-26",
    groups: [
      {
        title: "Bug fixes",
        notes: ["Verify native packages of other platforms"],
      },
    ],
    id: "release-0-16-1",
    readableDate: "26 October 2026",
    version: "0.16.1",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.15.0...v0.16.0",
    date: "2026-10-25",
    groups: [
      {
        title: "Breaking changes",
        notes: [
          "The mokly CLI is a native Rust binary.",
          "Check, export, and review are removed.",
          "The configuration is the data-only file mokly.config.json, and --config names another JSON file.",
          "No command writes generated output into the repository.",
          "Every screen and component has its own props and optional variants.",
        ],
      },
      {
        title: "Features",
        notes: [
          "Author screens and components as HTML with YAML front matter",
          "Render comparisons from sources without generated output",
          "Render the Browse shell in the browser from catalogue index v7",
        ],
      },
    ],
    id: "release-0-16-0",
    readableDate: "25 October 2026",
    version: "0.16.0",
  },
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
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.11.0...v0.12.0",
    date: "2026-09-22",
    groups: [
      {
        notes: [
          "Color rich success ticks green",
          "Improve terminal experience",
          "Show previous versions of removed pages and screens",
          "Hydrate the shared Browse shell",
          "Present removed previews as viewer-owned documents",
        ],
        title: "Features",
      },
      {
        notes: [
          "Align the mobile inspector surface",
          "Extend the registry retry window",
          "Match the inspector divider to the navigation divider",
          "Authenticate frame document handoffs",
          "Repair the embedded stylesheet layout",
        ],
        title: "Bug fixes",
      },
      {
        notes: [
          "Parallelize verification suites",
          "Skip unchanged component view comparisons",
        ],
        title: "Performance",
      },
      {
        notes: ["Bump @mokly/viewer from 0.2.0 to 0.3.0"],
        title: "Dependencies",
      },
    ],
    id: "release-0-12-0",
    readableDate: "22 September 2026",
    version: "0.12.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.10.0...v0.11.0",
    date: "2026-09-17",
    groups: [
      {
        notes: [
          "Default generated output to derived",
          "Ship the CLI guides in the package",
          "Add comment anchoring primitives",
        ],
        title: "Features",
      },
      {
        notes: ["Bump @mokly/viewer from 0.1.0 to 0.2.0"],
        title: "Dependencies",
      },
    ],
    id: "release-0-11-0",
    readableDate: "17 September 2026",
    version: "0.11.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.9.0...v0.10.0",
    date: "2026-09-17",
    groups: [
      {
        notes: [
          "Add @mokly/viewer embeddable viewer package",
          "Upstream the Mokabook 0.8.0 consumer patch",
        ],
        title: "Features",
      },
      {
        notes: [
          "Pin the viewer initial version",
          "Surface worker render failures on the server",
        ],
        title: "Bug fixes",
      },
      {
        notes: [
          "Cache compiled exclusion matchers per config",
          "Dedupe affected usages in one pass",
        ],
        title: "Performance",
      },
    ],
    id: "release-0-10-0",
    readableDate: "17 September 2026",
    version: "0.10.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.8.0...v0.9.0",
    date: "2026-09-15",
    groups: [
      {
        notes: [
          "Install and import @mokly/mokly. The unscoped name is not a package alias; the CLI remains mokly.",
        ],
        title: "Breaking changes",
      },
      {
        notes: [
          "Publish catalogues to upload services",
          "Add CSS change attribution",
          "Add derived baseline output",
          "Split catalogue navigation into sections",
        ],
        title: "Features",
      },
      {
        notes: [
          "Keep added and removed screens current-only",
          "Load selected comparisons and recover expired snapshots",
          "Preserve catalogue state on evidence updates",
        ],
        title: "Bug fixes",
      },
    ],
    id: "release-0-9-0",
    readableDate: "15 September 2026",
    version: "0.9.0",
  },
];
