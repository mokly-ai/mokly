import type { Release } from "./release";

export const nativeReleases = [
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
] as const satisfies readonly Release[];
