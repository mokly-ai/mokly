import type { Release } from "./release";

/** Releases 0.12.0 to 0.9.0, from the Mokly name to the shared Browse shell. */
export const earlyReleases = [
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.11.0...v0.12.0",
    date: "2026-09-22",
    groups: [
      {
        kind: "features",
        notes: [
          "**cli:** color rich success ticks green ([#91](https://github.com/mokly-ai/mokly/issues/91)) ([48af447](https://github.com/mokly-ai/mokly/commit/48af447ce2834bc4b03266066a2210845aab18c4))",
          "**cli:** improve terminal experience ([#85](https://github.com/mokly-ai/mokly/issues/85)) ([ddb263b](https://github.com/mokly-ai/mokly/commit/ddb263ba694f94484debbea73916f67226d5b1f5))",
          "show previous versions of removed pages and screens ([#98](https://github.com/mokly-ai/mokly/issues/98)) ([a177abd](https://github.com/mokly-ai/mokly/commit/a177abd22da825576a11c7d102232c71b7d83f32))",
          "**viewer:** hydrate the shared Browse shell ([#95](https://github.com/mokly-ai/mokly/issues/95)) ([b5c9f07](https://github.com/mokly-ai/mokly/commit/b5c9f07dc70290c990f9608fc0d75e58188a50b5))",
          "**viewer:** present removed previews as viewer-owned documents ([#104](https://github.com/mokly-ai/mokly/issues/104)) ([f23c376](https://github.com/mokly-ai/mokly/commit/f23c376966343a226a8b7e76aee32a784cf08fa4))",
        ],
      },
      {
        kind: "fixes",
        notes: [
          "align mobile inspector surface ([#92](https://github.com/mokly-ai/mokly/issues/92)) ([310749a](https://github.com/mokly-ai/mokly/commit/310749aa2b715638ee95bf610657f45ef949f463))",
          "**release:** extend registry retry window ([#86](https://github.com/mokly-ai/mokly/issues/86)) ([8c4701f](https://github.com/mokly-ai/mokly/commit/8c4701f7bc26347d0b061cf4e78e0e2ef0e400a0))",
          "**shell:** match inspector divider to nav divider ([#90](https://github.com/mokly-ai/mokly/issues/90)) ([9bd6f20](https://github.com/mokly-ai/mokly/commit/9bd6f20ab10cc8fb403de68359de59dd82d94141))",
          "**viewer:** authenticate frame document handoffs ([#99](https://github.com/mokly-ai/mokly/issues/99)) ([b95ad47](https://github.com/mokly-ai/mokly/commit/b95ad472c04768e777bc8f2d3b0555380f0e8f61))",
          "**viewer:** repair embedded stylesheet layout ([#103](https://github.com/mokly-ai/mokly/issues/103)) ([dde661c](https://github.com/mokly-ai/mokly/commit/dde661c7695773170e8c86ee1960bf9e4eab144c))",
        ],
      },
      {
        kind: "performance",
        notes: [
          "**ci:** parallelize verification suites ([#93](https://github.com/mokly-ai/mokly/issues/93)) ([3f6ea42](https://github.com/mokly-ai/mokly/commit/3f6ea4265129112d7626c1fc16e6d100b33fdf4f))",
          "**review:** skip unchanged component view comparisons ([#94](https://github.com/mokly-ai/mokly/issues/94)) ([20e55ca](https://github.com/mokly-ai/mokly/commit/20e55ca02a7274b659031b2295bc4d3e92360767))",
        ],
      },
      {
        kind: "deps",
        notes: [
          "The following workspace dependencies were updated\n  * dependencies\n    * @mokly/viewer bumped from 0.2.0 to 0.3.0",
        ],
      },
    ],
    version: "0.12.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.10.0...v0.11.0",
    date: "2026-09-17",
    groups: [
      {
        kind: "features",
        notes: [
          "default generated output to derived ([#81](https://github.com/mokly-ai/mokly/issues/81)) ([37a5ea8](https://github.com/mokly-ai/mokly/commit/37a5ea8919c880327e6baf88a3d9e7fa76975852))",
          "**docs:** ship the CLI guides in the package ([#82](https://github.com/mokly-ai/mokly/issues/82)) ([9296ee3](https://github.com/mokly-ai/mokly/commit/9296ee322b65f4fce992b464ca7da46ebcd963eb))",
          "**viewer:** add comment anchoring primitives ([#84](https://github.com/mokly-ai/mokly/issues/84)) ([adac9e1](https://github.com/mokly-ai/mokly/commit/adac9e1d56549a5ba164bf90508a93fd59d34e44))",
        ],
      },
      {
        kind: "deps",
        notes: [
          "The following workspace dependencies were updated\n  * dependencies\n    * @mokly/viewer bumped from 0.1.0 to 0.2.0",
        ],
      },
    ],
    version: "0.11.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.9.0...v0.10.0",
    date: "2026-09-17",
    groups: [
      {
        kind: "features",
        notes: [
          "add @mokly/viewer embeddable viewer package ([#76](https://github.com/mokly-ai/mokly/issues/76)) ([d7b0ac3](https://github.com/mokly-ai/mokly/commit/d7b0ac356b9397caf1db4e8c88add161da8c0f1b))",
          "upstream the Mokabook 0.8.0 consumer patch ([#74](https://github.com/mokly-ai/mokly/issues/74)) ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))",
          "**xtask:** add commit-title-lint gate ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))",
        ],
      },
      {
        kind: "fixes",
        notes: [
          "**release:** pin viewer initial version ([#78](https://github.com/mokly-ai/mokly/issues/78)) ([65feea8](https://github.com/mokly-ai/mokly/commit/65feea88c876ee79a5bd1feef16705caa66eebbc))",
          "**serve:** drop dead anchor guard in localHost ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))",
          "**serve:** surface worker render failures on the server ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))",
          "**serve:** validate transferred exclusions without re-prepending ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))",
        ],
      },
      {
        kind: "performance",
        notes: [
          "**build:** cache compiled exclusion matchers per config ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))",
          "**workspace:** dedupe affected usages in one pass ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))",
        ],
      },
    ],
    version: "0.10.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.8.0...v0.9.0",
    date: "2026-09-15",
    groups: [
      {
        kind: "breaking",
        notes: [
          "npm consumers must install and import @mokly/mokly; the unscoped name is not a package alias.",
          "Install and import @mokly/mokly. The unscoped name is not a package alias; the CLI remains mokly.",
          "rename package to Mokly ([#66](https://github.com/mokly-ai/mokly/issues/66))",
          "rename package to Mokly",
        ],
      },
      {
        kind: "features",
        notes: [
          "add CSS change attribution ([#72](https://github.com/mokly-ai/mokly/issues/72)) ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))",
          "add derived baseline output ([#70](https://github.com/mokly-ai/mokly/issues/70)) ([9af53be](https://github.com/mokly-ai/mokly/commit/9af53beb1dc09c3ff9381fccf4ff5bc52eafb5b5))",
          "**design:** add stylesheet evidence mockups ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))",
          "**design:** depict stylesheet evidence inside a loaded comparison ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))",
          "publish catalogues to upload services ([#71](https://github.com/mokly-ai/mokly/issues/71)) ([9580d74](https://github.com/mokly-ai/mokly/commit/9580d74d8b9027073099ab71abaa9dfc91a7ac5e))",
          "rename package to Mokly ([96a7ca6](https://github.com/mokly-ai/mokly/commit/96a7ca66ba89e24017152368e2154e75230e9f9a))",
          "rename package to Mokly ([#66](https://github.com/mokly-ai/mokly/issues/66)) ([f0fcfa9](https://github.com/mokly-ai/mokly/commit/f0fcfa9bbc595defd5efd3991d6deda6ef1574a1))",
          "**review:** add the review.css-analysis timing span ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))",
          "**shell:** split catalogue navigation into sections ([#60](https://github.com/mokly-ai/mokly/issues/60)) ([83b377a](https://github.com/mokly-ai/mokly/commit/83b377a54c5005f7f15800549bcc5cf4544dcda4))",
        ],
      },
      {
        kind: "fixes",
        notes: [
          "address Mokly migration review findings ([681db1a](https://github.com/mokly-ai/mokly/commit/681db1aa2ed63dc94f5bb40b563a2a95ff526167))",
          "**benchmark:** expect zero Changes for an unrelated shared-rule edit ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))",
          "**design:** show impact screens as plain previews and fix card spacing ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))",
          "keep added and removed screens current-only ([#64](https://github.com/mokly-ai/mokly/issues/64)) ([9301443](https://github.com/mokly-ai/mokly/commit/93014436aea164d76c504d2d06a4edde98f5025c))",
          "load selected comparisons and recover expired snapshots ([#62](https://github.com/mokly-ai/mokly/issues/62)) ([b19dc62](https://github.com/mokly-ai/mokly/commit/b19dc627f78354863ddf60478f3cfa6671ffdfa2))",
          "pack bootstrap from the exact source tip ([aeb9a26](https://github.com/mokly-ai/mokly/commit/aeb9a26c510621dbc37b1a8a84552ec42bfa2736))",
          "preserve catalogue state on evidence updates ([#59](https://github.com/mokly-ai/mokly/issues/59)) ([7cefa42](https://github.com/mokly-ai/mokly/commit/7cefa427a1612458c0f9f7f40ed205aa02c12687))",
          "preserve Usage link focus during updates ([#63](https://github.com/mokly-ai/mokly/issues/63)) ([e0dc6d1](https://github.com/mokly-ai/mokly/commit/e0dc6d10163e79e0b991d1cd25b53778810dffe7))",
          "publish under the Mokly npm scope ([#67](https://github.com/mokly-ai/mokly/issues/67)) ([bf1f5be](https://github.com/mokly-ai/mokly/commit/bf1f5be35f7296a185081b0cb830e068577eb598))",
          "publish under the Mokly npm scope ([#69](https://github.com/mokly-ai/mokly/issues/69)) ([5b4c647](https://github.com/mokly-ai/mokly/commit/5b4c647b6138fa08d65a7573f01b1c342ec9b019))",
          "**review:** preserve function-name boundaries in CSS serialization ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))",
        ],
      },
    ],
    version: "0.9.0",
  },
] as const satisfies readonly Release[];
