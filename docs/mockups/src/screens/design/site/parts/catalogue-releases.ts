import type { Release } from "./release";

/** Releases 0.15.0 to 0.13.0, from navigation paths to stylesheet evidence. */
export const catalogueReleases = [
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.14.0...v0.15.0",
    date: "2026-10-12",
    groups: [
      {
        kind: "breaking",
        notes: [
          "Entry `dependencies`, component `ownedDependencies` and `review.sharedImpact` have no effect. Mokly warns and ignores them, and a `--strict` command fails on these warnings. Delete them, and declare component CSS with the component's `stylesheets` field.",
          "Generated output uses manifest v10, catalogue read model v6 and review result v7. Rebuild and commit `mokly-generated/` output that 0.14.0 or earlier wrote, and regenerate exports. A comparison base that 0.14.0 or earlier built shows Changes as unavailable until the base includes this version. Hosts that embed the viewer need `@mokly/viewer` 0.6.0 to read catalogues from this release.",
          'Rename `ManifestV9`, `ReviewResultV6` and `ScreenReviewV6` to `ManifestV10`, `ReviewResultV7` and `ScreenReviewV7`. `MoklyVersionError.boundary` can now be `"review"`.',
        ],
      },
      {
        kind: "features",
        notes: [
          "classify each changed CSS rule by the elements that it matches ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))",
          "declare component CSS with the `stylesheets` field ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))",
          "move generated output to manifest v10, catalogue read model v6 and review result v7 ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))",
          "remove source-path evidence inputs ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))",
          "rename the versioned manifest and review types ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))",
          "**xtask:** run the remote gate from a pushed base commit ([#193](https://github.com/mokly-ai/mokly/issues/193)) ([d9f2148](https://github.com/mokly-ai/mokly/commit/d9f2148332f53eee5bc991a2db39a32792d1b25e))",
        ],
      },
      {
        kind: "fixes",
        notes: [
          "ignore foreign links, keep snapshot forms, remove wording tests ([#191](https://github.com/mokly-ai/mokly/issues/191)) ([c66daeb](https://github.com/mokly-ai/mokly/commit/c66daeb58d3b3e822dfd0482a587a8f3a8e58218))",
          "**release:** repair release evidence and manual complete retries ([#183](https://github.com/mokly-ai/mokly/issues/183)) ([a0e1219](https://github.com/mokly-ai/mokly/commit/a0e1219c0541618e882f563f8f73b13bb00e7fa3))",
          "**server:** keep authored files readable across reloads and restarts ([#185](https://github.com/mokly-ai/mokly/issues/185)) ([a90badb](https://github.com/mokly-ai/mokly/commit/a90badb6a79c05a20fb938e894232e0b5b946b30))",
          "**xtask:** warn on stuck boxes after suites ([#181](https://github.com/mokly-ai/mokly/issues/181)) ([1086732](https://github.com/mokly-ai/mokly/commit/1086732a634f0fa42837f45dd290745d114f9701))",
        ],
      },
      {
        kind: "deps",
        notes: [
          "The following workspace dependencies were updated\n  * dependencies\n    * @mokly/viewer bumped from 0.5.0 to 0.6.0",
        ],
      },
    ],
    version: "0.15.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.13.0...v0.14.0",
    date: "2026-10-08",
    groups: [
      {
        kind: "breaking",
        notes: [
          "**publish:** mokly publish now requires a clean checkout. Commit, stash or ignore uncommitted files before publishing. There is no override flag.",
          "Use mokly-viewer/ and generations/, ownership v3 and upload v2. Older services reject publication with the documented version error until their receiver and viewer are updated.",
          "file-path identity and Markdown documents ([#131](https://github.com/mokly-ai/mokly/issues/131))",
          "Path identity removes id, navPath, entries and entriesDir. Use roots and file-derived paths. Rebuild manifest v8 and consume read model v4, review result v5, disclosure storage v4 and /view/<path>/ URLs. Earlier formats, URLs, ids, disclosure keys and configuration are not read or translated. The release note documents manual migration only.",
        ],
      },
      {
        kind: "features",
        notes: [
          "**cache:** make .mokly-cache ignore itself ([#145](https://github.com/mokly-ai/mokly/issues/145)) ([43ae07b](https://github.com/mokly-ai/mokly/commit/43ae07b6b25ee8af5805430e43ca70f4f20dcff3))",
          "**deps:** baseline-relative audit and daily update PRs ([#157](https://github.com/mokly-ai/mokly/issues/157)) ([6bb6421](https://github.com/mokly-ai/mokly/commit/6bb642193bd6d3fce4a304ab9a8eab25ff85a3d2))",
          "file-path identity and Markdown documents ([#131](https://github.com/mokly-ai/mokly/issues/131)) ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))",
          "**publish:** require a clean checkout ([#168](https://github.com/mokly-ai/mokly/issues/168)) ([acac1c7](https://github.com/mokly-ai/mokly/commit/acac1c73b9f3379ef14338485c3dccfa074b7b1c))",
          "simplify generated output and delivery ([#156](https://github.com/mokly-ai/mokly/issues/156)) ([b39d89a](https://github.com/mokly-ai/mokly/commit/b39d89a48b4013c331ac0d20072b1ffb9136c1af))",
          "tier MockLink asChild placement and add build warnings ([#124](https://github.com/mokly-ai/mokly/issues/124)) ([f66c274](https://github.com/mokly-ai/mokly/commit/f66c274d0098ce3c67ff933b043a2cc38661b91e))",
          "**viewer:** add route-scoped shell bootstraps ([#120](https://github.com/mokly-ai/mokly/issues/120)) ([b2c82c1](https://github.com/mokly-ai/mokly/commit/b2c82c1591c91f2550a66c464833b1f864bdab07))",
          "**xtask:** run the complete gate on Blacksmith Testboxes ([#160](https://github.com/mokly-ai/mokly/issues/160)) ([fcc5059](https://github.com/mokly-ai/mokly/commit/fcc50591dd1a8d6d3b85c9c3c8160a6a4270294e))",
        ],
      },
      {
        kind: "fixes",
        notes: [
          "**build:** ignore source maps in CSS Modules ([#144](https://github.com/mokly-ai/mokly/issues/144)) ([f8ab241](https://github.com/mokly-ai/mokly/commit/f8ab241ff646662b1eb588f0d8ea42331784da24))",
          "**build:** keep lock directories on release ([#132](https://github.com/mokly-ai/mokly/issues/132)) ([781da7a](https://github.com/mokly-ai/mokly/commit/781da7ae3261e6694a5ef5608a91f3e34061f6d0))",
          "**ci:** publish npm releases from GitHub runners ([#126](https://github.com/mokly-ai/mokly/issues/126)) ([b4a02a3](https://github.com/mokly-ai/mokly/commit/b4a02a3014732d6488bdd2f1c33a0efff6421520))",
          "**deps:** add expiring braces audit exception ([#130](https://github.com/mokly-ai/mokly/issues/130)) ([1dc9158](https://github.com/mokly-ai/mokly/commit/1dc91580c750020d8badad81c89987b06c447efa))",
          "**deps:** apply in-range dependency updates ([#146](https://github.com/mokly-ai/mokly/issues/146)) ([f1ab129](https://github.com/mokly-ai/mokly/commit/f1ab12923fdcc848d7f87c5694aa2fdb88d28d5f))",
          "**deps:** patch source-map-js advisory ([#140](https://github.com/mokly-ai/mokly/issues/140)) ([ad2b3ec](https://github.com/mokly-ai/mokly/commit/ad2b3ece65205f45e4aab4c70106dc60c8c95563))",
          "**export:** read only specifiers in scripts ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))",
          "prevent output write and frame usage races ([#129](https://github.com/mokly-ai/mokly/issues/129)) ([800fe9f](https://github.com/mokly-ai/mokly/commit/800fe9f88a0173429b25baa1bcf41ed9e59b2256))",
          "**server:** keep the checked closure on reload ([#172](https://github.com/mokly-ai/mokly/issues/172)) ([eea44b6](https://github.com/mokly-ai/mokly/commit/eea44b6b4ccb722270a1227244b225b49309da06))",
          "**viewer:** keep stacked narrow frames reachable ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))",
          "**xtask:** close Testbox SSH before cleanup to end boxes promptly ([#177](https://github.com/mokly-ai/mokly/issues/177)) ([3a7be25](https://github.com/mokly-ai/mokly/commit/3a7be25aad57184ad6e62e7466210f9959e1533e))",
          "**xtask:** resolve remote verification review findings 4 to 14 ([#164](https://github.com/mokly-ai/mokly/issues/164)) ([3ce2fb5](https://github.com/mokly-ai/mokly/commit/3ce2fb554ede6448a9940222ad1ea01e93b1bdd5))",
        ],
      },
      {
        kind: "performance",
        notes: [
          "**test:** run more tests in parallel locally ([#148](https://github.com/mokly-ai/mokly/issues/148)) ([6bf6251](https://github.com/mokly-ai/mokly/commit/6bf6251791dc3c02e9c3190a10c0167db156173e))",
        ],
      },
      {
        kind: "docs",
        notes: [
          "present moves in the guides and contracts ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))",
        ],
      },
      {
        kind: "deps",
        notes: [
          "The following workspace dependencies were updated\n  * dependencies\n    * @mokly/viewer bumped from 0.4.0 to 0.5.0",
        ],
      },
    ],
    version: "0.14.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.12.0...v0.13.0",
    date: "2026-09-30",
    groups: [
      {
        kind: "breaking",
        notes: [
          "**publish:** `mokly publish` no longer uploads one catalogue archive; it runs the plan, blob and complete exchange documented in docs/protocol/mokly-upload.md, so receivers must implement that exchange. Export ownership markers are schema 2 with per-file SHA-256 digests and sizes; schema 1 markers are rejected, so export directories written by earlier releases must be removed before exporting again. Successful plain publish output is now `Published Mokly catalogue. <uploaded> files uploaded, <unchanged> unchanged.` or `Mokly catalogue already published for this commit.`, optionally followed by the viewer URL line.",
          "defineCollection, collection, and the collection types are removed; place entries with navPath or nested folder(). Generated manifests are schema v6 and the public catalogue read model is v2 (folder nodes, navPath, no collections or ancestors). Rebuild generated output after upgrading.",
        ],
      },
      {
        kind: "features",
        notes: [
          "add co-located entries and screen variants ([ce3da27](https://github.com/mokly-ai/mokly/commit/ce3da27f2c5d9d9c8e7fbb4faf1b9cac5b167a33))",
          "**design:** add the disabled and validation roles ([d4228f9](https://github.com/mokly-ai/mokly/commit/d4228f90b97b2698a1b6bed53ddbdf446d4750c8))",
          "**publish:** upload catalogue content deltas ([#122](https://github.com/mokly-ai/mokly/issues/122)) ([0c8245f](https://github.com/mokly-ai/mokly/commit/0c8245f8dd3d6fd9802f8d2bf9cdea43819f9a69))",
          "replace collections with navigation paths ([#123](https://github.com/mokly-ai/mokly/issues/123)) ([b4314fe](https://github.com/mokly-ai/mokly/commit/b4314fec74ea931862a8ab2afab69d560040396a))",
          "**viewer:** add Auto/Light/Dark appearance ([#96](https://github.com/mokly-ai/mokly/issues/96)) ([d4228f9](https://github.com/mokly-ai/mokly/commit/d4228f90b97b2698a1b6bed53ddbdf446d4750c8))",
          "**viewer:** adopt the mokly-cloud logo ([#119](https://github.com/mokly-ai/mokly/issues/119)) ([3699c56](https://github.com/mokly-ai/mokly/commit/3699c56619fd9450a001547ffc7e92b9f8536fba))",
          "**viewer:** align comparison pane scrolling ([#121](https://github.com/mokly-ai/mokly/issues/121)) ([d71b03b](https://github.com/mokly-ai/mokly/commit/d71b03b7dc40710ef8b187beb6a25ea7a07d6fda))",
        ],
      },
      {
        kind: "fixes",
        notes: [
          "align screen variants and history ([#115](https://github.com/mokly-ai/mokly/issues/115)) ([2ec4d83](https://github.com/mokly-ai/mokly/commit/2ec4d837df2c2fdbd74453b5844a36bd9b4272bf))",
          "**ci:** align workflow tests with Blacksmith ([74043d2](https://github.com/mokly-ai/mokly/commit/74043d2ca8e45c18264b25c63882ea81e58b568d))",
          "**ci:** await navigation disclosure transitions ([#108](https://github.com/mokly-ai/mokly/issues/108)) ([2dac7b0](https://github.com/mokly-ai/mokly/commit/2dac7b04ab60dd3cb3729bdbb119b5d195e07ba8))",
          "**ci:** drain fixtures before removal ([d3d3e4c](https://github.com/mokly-ai/mokly/commit/d3d3e4ceae1241f979a540bacb5cdbbd38c75008))",
          "**ci:** drain fixtures before removal ([c19cccb](https://github.com/mokly-ai/mokly/commit/c19cccb969f495e0ed4dfd0798341e511640af6f))",
          "**ci:** enforce fixture-owned teardown ([a8e2ea4](https://github.com/mokly-ai/mokly/commit/a8e2ea4ff765be1342166c1e7a09017e9ee8972b))",
          "**ci:** enforce fixture-owned teardown ([a32b9f2](https://github.com/mokly-ai/mokly/commit/a32b9f292c4b2d1a7fe92b75b59c0f7ffdc45292))",
          "**ci:** pin release checkout action ([a59aab2](https://github.com/mokly-ai/mokly/commit/a59aab2ea8134ac1b4cc0d86ca5293aa4c50eb76))",
          "**ci:** prevent hydration timeouts and shutdown hangs ([47c5197](https://github.com/mokly-ai/mokly/commit/47c5197976ed65d5e89562c507e53f0bac067762))",
          "**ci:** resolve Node 24 once per run ([#113](https://github.com/mokly-ai/mokly/issues/113)) ([a233cbd](https://github.com/mokly-ai/mokly/commit/a233cbded960c3a753e111d9c2a46ef161fed989))",
          "**ci:** reuse one Node 24 version across jobs ([bbba28e](https://github.com/mokly-ai/mokly/commit/bbba28e3a61b9bc9ca650dbd1ce94e6f3449326b))",
          "**cli:** arm shutdown before ready output ([#106](https://github.com/mokly-ai/mokly/issues/106)) ([0216610](https://github.com/mokly-ai/mokly/commit/02166103317b312de2ecb0e1ffc63b4065136dfe))",
          "complete entry discovery follow-up ([#111](https://github.com/mokly-ai/mokly/issues/111)) ([5ea5258](https://github.com/mokly-ai/mokly/commit/5ea52589acb697cc375f4c2649056d257fa343f3))",
          "**viewer:** resolve effective views ([#112](https://github.com/mokly-ai/mokly/issues/112)) ([d665d06](https://github.com/mokly-ai/mokly/commit/d665d066388a1e21efc0016f32536909e040acdd))",
        ],
      },
      {
        kind: "performance",
        notes: [
          "**ci:** gate Node 24 checks on release PRs ([#114](https://github.com/mokly-ai/mokly/issues/114)) ([a8f408d](https://github.com/mokly-ai/mokly/commit/a8f408d16738e8d5461b23fdc32cd94198143038))",
        ],
      },
      {
        kind: "deps",
        notes: [
          "The following workspace dependencies were updated\n  * dependencies\n    * @mokly/viewer bumped from 0.3.0 to 0.4.0",
        ],
      },
    ],
    version: "0.13.0",
  },
] as const satisfies readonly Release[];
