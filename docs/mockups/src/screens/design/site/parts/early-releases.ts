import type { Release } from "./release";

export const earlyReleases = [
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
] as const satisfies readonly Release[];
