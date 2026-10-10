# Changelog

## [0.15.0](https://github.com/mokly-ai/mokly/compare/v0.14.0...v0.15.0) (2026-10-10)


### ⚠ BREAKING CHANGES

* Entry `dependencies`, component `ownedDependencies` and `review.sharedImpact` have no effect. Mokly warns and ignores them, and a `--strict` command fails on these warnings. Delete them, and declare component CSS with the component's `stylesheets` field.
* Generated output uses manifest v10, catalogue read model v6 and review result v7. Rebuild and commit `mokly-generated/` output that 0.14.0 or earlier wrote, and regenerate exports. A comparison base that 0.14.0 or earlier built shows Changes as unavailable until the base includes this version. Hosts that embed the viewer need `@mokly/viewer` 0.6.0 to read catalogues from this release.
* Rename `ManifestV9`, `ReviewResultV6` and `ScreenReviewV6` to `ManifestV10`, `ReviewResultV7` and `ScreenReviewV7`. `MoklyVersionError.boundary` can now be `"review"`.

### Features

* classify each changed CSS rule by the elements that it matches ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* declare component CSS with the `stylesheets` field ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* move generated output to manifest v10, catalogue read model v6 and review result v7 ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* remove source-path evidence inputs ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* rename the versioned manifest and review types ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))


### Bug Fixes

* ignore foreign links, keep snapshot forms, remove wording tests ([#191](https://github.com/mokly-ai/mokly/issues/191)) ([c66daeb](https://github.com/mokly-ai/mokly/commit/c66daeb58d3b3e822dfd0482a587a8f3a8e58218))
* **release:** repair release evidence and manual complete retries ([#183](https://github.com/mokly-ai/mokly/issues/183)) ([a0e1219](https://github.com/mokly-ai/mokly/commit/a0e1219c0541618e882f563f8f73b13bb00e7fa3))
* **server:** keep authored files readable across reloads and restarts ([#185](https://github.com/mokly-ai/mokly/issues/185)) ([a90badb](https://github.com/mokly-ai/mokly/commit/a90badb6a79c05a20fb938e894232e0b5b946b30))
* **xtask:** warn on stuck boxes after suites ([#181](https://github.com/mokly-ai/mokly/issues/181)) ([1086732](https://github.com/mokly-ai/mokly/commit/1086732a634f0fa42837f45dd290745d114f9701))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @mokly/viewer bumped from 0.5.0 to 0.6.0

## [0.14.0](https://github.com/mokly-ai/mokly/compare/v0.13.0...v0.14.0) (2026-10-08)


### ⚠ BREAKING CHANGES

* **publish:** mokly publish now requires a clean checkout. Commit, stash or ignore uncommitted files before publishing. There is no override flag.
* Use mokly-viewer/ and generations/, ownership v3 and upload v2. Older services reject publication with the documented version error until their receiver and viewer are updated.
* file-path identity and Markdown documents ([#131](https://github.com/mokly-ai/mokly/issues/131))
* Path identity removes id, navPath, entries and entriesDir. Use roots and file-derived paths. Rebuild manifest v8 and consume read model v4, review result v5, disclosure storage v4 and /view/<path>/ URLs. Earlier formats, URLs, ids, disclosure keys and configuration are not read or translated. The release note documents manual migration only.

### Features

* **cache:** make .mokly-cache ignore itself ([#145](https://github.com/mokly-ai/mokly/issues/145)) ([43ae07b](https://github.com/mokly-ai/mokly/commit/43ae07b6b25ee8af5805430e43ca70f4f20dcff3))
* **deps:** baseline-relative audit and daily update PRs ([#157](https://github.com/mokly-ai/mokly/issues/157)) ([6bb6421](https://github.com/mokly-ai/mokly/commit/6bb642193bd6d3fce4a304ab9a8eab25ff85a3d2))
* file-path identity and Markdown documents ([#131](https://github.com/mokly-ai/mokly/issues/131)) ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))
* **publish:** require a clean checkout ([#168](https://github.com/mokly-ai/mokly/issues/168)) ([acac1c7](https://github.com/mokly-ai/mokly/commit/acac1c73b9f3379ef14338485c3dccfa074b7b1c))
* simplify generated output and delivery ([#156](https://github.com/mokly-ai/mokly/issues/156)) ([b39d89a](https://github.com/mokly-ai/mokly/commit/b39d89a48b4013c331ac0d20072b1ffb9136c1af))
* tier MockLink asChild placement and add build warnings ([#124](https://github.com/mokly-ai/mokly/issues/124)) ([f66c274](https://github.com/mokly-ai/mokly/commit/f66c274d0098ce3c67ff933b043a2cc38661b91e))
* **viewer:** add route-scoped shell bootstraps ([#120](https://github.com/mokly-ai/mokly/issues/120)) ([b2c82c1](https://github.com/mokly-ai/mokly/commit/b2c82c1591c91f2550a66c464833b1f864bdab07))
* **xtask:** run the complete gate on Blacksmith Testboxes ([#160](https://github.com/mokly-ai/mokly/issues/160)) ([fcc5059](https://github.com/mokly-ai/mokly/commit/fcc50591dd1a8d6d3b85c9c3c8160a6a4270294e))


### Bug Fixes

* **build:** ignore source maps in CSS Modules ([#144](https://github.com/mokly-ai/mokly/issues/144)) ([f8ab241](https://github.com/mokly-ai/mokly/commit/f8ab241ff646662b1eb588f0d8ea42331784da24))
* **build:** keep lock directories on release ([#132](https://github.com/mokly-ai/mokly/issues/132)) ([781da7a](https://github.com/mokly-ai/mokly/commit/781da7ae3261e6694a5ef5608a91f3e34061f6d0))
* **ci:** publish npm releases from GitHub runners ([#126](https://github.com/mokly-ai/mokly/issues/126)) ([b4a02a3](https://github.com/mokly-ai/mokly/commit/b4a02a3014732d6488bdd2f1c33a0efff6421520))
* **deps:** add expiring braces audit exception ([#130](https://github.com/mokly-ai/mokly/issues/130)) ([1dc9158](https://github.com/mokly-ai/mokly/commit/1dc91580c750020d8badad81c89987b06c447efa))
* **deps:** apply in-range dependency updates ([#146](https://github.com/mokly-ai/mokly/issues/146)) ([f1ab129](https://github.com/mokly-ai/mokly/commit/f1ab12923fdcc848d7f87c5694aa2fdb88d28d5f))
* **deps:** patch source-map-js advisory ([#140](https://github.com/mokly-ai/mokly/issues/140)) ([ad2b3ec](https://github.com/mokly-ai/mokly/commit/ad2b3ece65205f45e4aab4c70106dc60c8c95563))
* **export:** read only specifiers in scripts ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))
* prevent output write and frame usage races ([#129](https://github.com/mokly-ai/mokly/issues/129)) ([800fe9f](https://github.com/mokly-ai/mokly/commit/800fe9f88a0173429b25baa1bcf41ed9e59b2256))
* **server:** keep the checked closure on reload ([#172](https://github.com/mokly-ai/mokly/issues/172)) ([eea44b6](https://github.com/mokly-ai/mokly/commit/eea44b6b4ccb722270a1227244b225b49309da06))
* **viewer:** keep stacked narrow frames reachable ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))
* **xtask:** close Testbox SSH before cleanup to end boxes promptly ([#177](https://github.com/mokly-ai/mokly/issues/177)) ([3a7be25](https://github.com/mokly-ai/mokly/commit/3a7be25aad57184ad6e62e7466210f9959e1533e))
* **xtask:** resolve remote verification review findings 4 to 14 ([#164](https://github.com/mokly-ai/mokly/issues/164)) ([3ce2fb5](https://github.com/mokly-ai/mokly/commit/3ce2fb554ede6448a9940222ad1ea01e93b1bdd5))


### Performance Improvements

* **test:** run more tests in parallel locally ([#148](https://github.com/mokly-ai/mokly/issues/148)) ([6bf6251](https://github.com/mokly-ai/mokly/commit/6bf6251791dc3c02e9c3190a10c0167db156173e))


### Documentation

* present moves in the guides and contracts ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @mokly/viewer bumped from 0.4.0 to 0.5.0

## [0.13.0](https://github.com/mokly-ai/mokly/compare/v0.12.0...v0.13.0) (2026-09-30)


### ⚠ BREAKING CHANGES

* **publish:** `mokly publish` no longer uploads one catalogue archive; it runs the plan, blob and complete exchange documented in docs/protocol/mokly-upload.md, so receivers must implement that exchange. Export ownership markers are schema 2 with per-file SHA-256 digests and sizes; schema 1 markers are rejected, so export directories written by earlier releases must be removed before exporting again. Successful plain publish output is now `Published Mokly catalogue. <uploaded> files uploaded, <unchanged> unchanged.` or `Mokly catalogue already published for this commit.`, optionally followed by the viewer URL line.
* defineCollection, collection, and the collection types are removed; place entries with navPath or nested folder(). Generated manifests are schema v6 and the public catalogue read model is v2 (folder nodes, navPath, no collections or ancestors). Rebuild generated output after upgrading.

### Features

* add co-located entries and screen variants ([ce3da27](https://github.com/mokly-ai/mokly/commit/ce3da27f2c5d9d9c8e7fbb4faf1b9cac5b167a33))
* **design:** add the disabled and validation roles ([d4228f9](https://github.com/mokly-ai/mokly/commit/d4228f90b97b2698a1b6bed53ddbdf446d4750c8))
* **publish:** upload catalogue content deltas ([#122](https://github.com/mokly-ai/mokly/issues/122)) ([0c8245f](https://github.com/mokly-ai/mokly/commit/0c8245f8dd3d6fd9802f8d2bf9cdea43819f9a69))
* replace collections with navigation paths ([#123](https://github.com/mokly-ai/mokly/issues/123)) ([b4314fe](https://github.com/mokly-ai/mokly/commit/b4314fec74ea931862a8ab2afab69d560040396a))
* **viewer:** add Auto/Light/Dark appearance ([#96](https://github.com/mokly-ai/mokly/issues/96)) ([d4228f9](https://github.com/mokly-ai/mokly/commit/d4228f90b97b2698a1b6bed53ddbdf446d4750c8))
* **viewer:** adopt the mokly-cloud logo ([#119](https://github.com/mokly-ai/mokly/issues/119)) ([3699c56](https://github.com/mokly-ai/mokly/commit/3699c56619fd9450a001547ffc7e92b9f8536fba))
* **viewer:** align comparison pane scrolling ([#121](https://github.com/mokly-ai/mokly/issues/121)) ([d71b03b](https://github.com/mokly-ai/mokly/commit/d71b03b7dc40710ef8b187beb6a25ea7a07d6fda))


### Bug Fixes

* align screen variants and history ([#115](https://github.com/mokly-ai/mokly/issues/115)) ([2ec4d83](https://github.com/mokly-ai/mokly/commit/2ec4d837df2c2fdbd74453b5844a36bd9b4272bf))
* **ci:** align workflow tests with Blacksmith ([74043d2](https://github.com/mokly-ai/mokly/commit/74043d2ca8e45c18264b25c63882ea81e58b568d))
* **ci:** await navigation disclosure transitions ([#108](https://github.com/mokly-ai/mokly/issues/108)) ([2dac7b0](https://github.com/mokly-ai/mokly/commit/2dac7b04ab60dd3cb3729bdbb119b5d195e07ba8))
* **ci:** drain fixtures before removal ([d3d3e4c](https://github.com/mokly-ai/mokly/commit/d3d3e4ceae1241f979a540bacb5cdbbd38c75008))
* **ci:** drain fixtures before removal ([c19cccb](https://github.com/mokly-ai/mokly/commit/c19cccb969f495e0ed4dfd0798341e511640af6f))
* **ci:** enforce fixture-owned teardown ([a8e2ea4](https://github.com/mokly-ai/mokly/commit/a8e2ea4ff765be1342166c1e7a09017e9ee8972b))
* **ci:** enforce fixture-owned teardown ([a32b9f2](https://github.com/mokly-ai/mokly/commit/a32b9f292c4b2d1a7fe92b75b59c0f7ffdc45292))
* **ci:** pin release checkout action ([a59aab2](https://github.com/mokly-ai/mokly/commit/a59aab2ea8134ac1b4cc0d86ca5293aa4c50eb76))
* **ci:** prevent hydration timeouts and shutdown hangs ([47c5197](https://github.com/mokly-ai/mokly/commit/47c5197976ed65d5e89562c507e53f0bac067762))
* **ci:** resolve Node 24 once per run ([#113](https://github.com/mokly-ai/mokly/issues/113)) ([a233cbd](https://github.com/mokly-ai/mokly/commit/a233cbded960c3a753e111d9c2a46ef161fed989))
* **ci:** reuse one Node 24 version across jobs ([bbba28e](https://github.com/mokly-ai/mokly/commit/bbba28e3a61b9bc9ca650dbd1ce94e6f3449326b))
* **cli:** arm shutdown before ready output ([#106](https://github.com/mokly-ai/mokly/issues/106)) ([0216610](https://github.com/mokly-ai/mokly/commit/02166103317b312de2ecb0e1ffc63b4065136dfe))
* complete entry discovery follow-up ([#111](https://github.com/mokly-ai/mokly/issues/111)) ([5ea5258](https://github.com/mokly-ai/mokly/commit/5ea52589acb697cc375f4c2649056d257fa343f3))
* **viewer:** resolve effective views ([#112](https://github.com/mokly-ai/mokly/issues/112)) ([d665d06](https://github.com/mokly-ai/mokly/commit/d665d066388a1e21efc0016f32536909e040acdd))


### Performance Improvements

* **ci:** gate Node 24 checks on release PRs ([#114](https://github.com/mokly-ai/mokly/issues/114)) ([a8f408d](https://github.com/mokly-ai/mokly/commit/a8f408d16738e8d5461b23fdc32cd94198143038))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @mokly/viewer bumped from 0.3.0 to 0.4.0

## [0.12.0](https://github.com/mokly-ai/mokly/compare/v0.11.0...v0.12.0) (2026-09-22)


### Features

* **cli:** color rich success ticks green ([#91](https://github.com/mokly-ai/mokly/issues/91)) ([48af447](https://github.com/mokly-ai/mokly/commit/48af447ce2834bc4b03266066a2210845aab18c4))
* **cli:** improve terminal experience ([#85](https://github.com/mokly-ai/mokly/issues/85)) ([ddb263b](https://github.com/mokly-ai/mokly/commit/ddb263ba694f94484debbea73916f67226d5b1f5))
* show previous versions of removed pages and screens ([#98](https://github.com/mokly-ai/mokly/issues/98)) ([a177abd](https://github.com/mokly-ai/mokly/commit/a177abd22da825576a11c7d102232c71b7d83f32))
* **viewer:** hydrate the shared Browse shell ([#95](https://github.com/mokly-ai/mokly/issues/95)) ([b5c9f07](https://github.com/mokly-ai/mokly/commit/b5c9f07dc70290c990f9608fc0d75e58188a50b5))
* **viewer:** present removed previews as viewer-owned documents ([#104](https://github.com/mokly-ai/mokly/issues/104)) ([f23c376](https://github.com/mokly-ai/mokly/commit/f23c376966343a226a8b7e76aee32a784cf08fa4))


### Bug Fixes

* align mobile inspector surface ([#92](https://github.com/mokly-ai/mokly/issues/92)) ([310749a](https://github.com/mokly-ai/mokly/commit/310749aa2b715638ee95bf610657f45ef949f463))
* **release:** extend registry retry window ([#86](https://github.com/mokly-ai/mokly/issues/86)) ([8c4701f](https://github.com/mokly-ai/mokly/commit/8c4701f7bc26347d0b061cf4e78e0e2ef0e400a0))
* **shell:** match inspector divider to nav divider ([#90](https://github.com/mokly-ai/mokly/issues/90)) ([9bd6f20](https://github.com/mokly-ai/mokly/commit/9bd6f20ab10cc8fb403de68359de59dd82d94141))
* **viewer:** authenticate frame document handoffs ([#99](https://github.com/mokly-ai/mokly/issues/99)) ([b95ad47](https://github.com/mokly-ai/mokly/commit/b95ad472c04768e777bc8f2d3b0555380f0e8f61))
* **viewer:** repair embedded stylesheet layout ([#103](https://github.com/mokly-ai/mokly/issues/103)) ([dde661c](https://github.com/mokly-ai/mokly/commit/dde661c7695773170e8c86ee1960bf9e4eab144c))


### Performance Improvements

* **ci:** parallelize verification suites ([#93](https://github.com/mokly-ai/mokly/issues/93)) ([3f6ea42](https://github.com/mokly-ai/mokly/commit/3f6ea4265129112d7626c1fc16e6d100b33fdf4f))
* **review:** skip unchanged component view comparisons ([#94](https://github.com/mokly-ai/mokly/issues/94)) ([20e55ca](https://github.com/mokly-ai/mokly/commit/20e55ca02a7274b659031b2295bc4d3e92360767))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @mokly/viewer bumped from 0.2.0 to 0.3.0

## [0.11.0](https://github.com/mokly-ai/mokly/compare/v0.10.0...v0.11.0) (2026-09-17)


### Features

* default generated output to derived ([#81](https://github.com/mokly-ai/mokly/issues/81)) ([37a5ea8](https://github.com/mokly-ai/mokly/commit/37a5ea8919c880327e6baf88a3d9e7fa76975852))
* **docs:** ship the CLI guides in the package ([#82](https://github.com/mokly-ai/mokly/issues/82)) ([9296ee3](https://github.com/mokly-ai/mokly/commit/9296ee322b65f4fce992b464ca7da46ebcd963eb))
* **viewer:** add comment anchoring primitives ([#84](https://github.com/mokly-ai/mokly/issues/84)) ([adac9e1](https://github.com/mokly-ai/mokly/commit/adac9e1d56549a5ba164bf90508a93fd59d34e44))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @mokly/viewer bumped from 0.1.0 to 0.2.0

## [0.10.0](https://github.com/mokly-ai/mokly/compare/v0.9.0...v0.10.0) (2026-09-17)


### Features

* add @mokly/viewer embeddable viewer package ([#76](https://github.com/mokly-ai/mokly/issues/76)) ([d7b0ac3](https://github.com/mokly-ai/mokly/commit/d7b0ac356b9397caf1db4e8c88add161da8c0f1b))
* upstream the Mokabook 0.8.0 consumer patch ([#74](https://github.com/mokly-ai/mokly/issues/74)) ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))
* **xtask:** add commit-title-lint gate ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))


### Bug Fixes

* **release:** pin viewer initial version ([#78](https://github.com/mokly-ai/mokly/issues/78)) ([65feea8](https://github.com/mokly-ai/mokly/commit/65feea88c876ee79a5bd1feef16705caa66eebbc))
* **serve:** drop dead anchor guard in localHost ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))
* **serve:** surface worker render failures on the server ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))
* **serve:** validate transferred exclusions without re-prepending ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))


### Performance Improvements

* **build:** cache compiled exclusion matchers per config ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))
* **workspace:** dedupe affected usages in one pass ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))

## [0.9.0](https://github.com/mokly-ai/mokly/compare/v0.8.0...v0.9.0) (2026-09-15)


### ⚠ BREAKING CHANGES

* npm consumers must install and import @mokly/mokly; the unscoped name is not a package alias.
* Install and import @mokly/mokly. The unscoped name is not a package alias; the CLI remains mokly.
* rename package to Mokly ([#66](https://github.com/mokly-ai/mokly/issues/66))
* rename package to Mokly

### Features

* add CSS change attribution ([#72](https://github.com/mokly-ai/mokly/issues/72)) ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))
* add derived baseline output ([#70](https://github.com/mokly-ai/mokly/issues/70)) ([9af53be](https://github.com/mokly-ai/mokly/commit/9af53beb1dc09c3ff9381fccf4ff5bc52eafb5b5))
* **design:** add stylesheet evidence mockups ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))
* **design:** depict stylesheet evidence inside a loaded comparison ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))
* publish catalogues to upload services ([#71](https://github.com/mokly-ai/mokly/issues/71)) ([9580d74](https://github.com/mokly-ai/mokly/commit/9580d74d8b9027073099ab71abaa9dfc91a7ac5e))
* rename package to Mokly ([96a7ca6](https://github.com/mokly-ai/mokly/commit/96a7ca66ba89e24017152368e2154e75230e9f9a))
* rename package to Mokly ([#66](https://github.com/mokly-ai/mokly/issues/66)) ([f0fcfa9](https://github.com/mokly-ai/mokly/commit/f0fcfa9bbc595defd5efd3991d6deda6ef1574a1))
* **review:** add the review.css-analysis timing span ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))
* **shell:** split catalogue navigation into sections ([#60](https://github.com/mokly-ai/mokly/issues/60)) ([83b377a](https://github.com/mokly-ai/mokly/commit/83b377a54c5005f7f15800549bcc5cf4544dcda4))


### Bug Fixes

* address Mokly migration review findings ([681db1a](https://github.com/mokly-ai/mokly/commit/681db1aa2ed63dc94f5bb40b563a2a95ff526167))
* **benchmark:** expect zero Changes for an unrelated shared-rule edit ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))
* **design:** show impact screens as plain previews and fix card spacing ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))
* keep added and removed screens current-only ([#64](https://github.com/mokly-ai/mokly/issues/64)) ([9301443](https://github.com/mokly-ai/mokly/commit/93014436aea164d76c504d2d06a4edde98f5025c))
* load selected comparisons and recover expired snapshots ([#62](https://github.com/mokly-ai/mokly/issues/62)) ([b19dc62](https://github.com/mokly-ai/mokly/commit/b19dc627f78354863ddf60478f3cfa6671ffdfa2))
* pack bootstrap from the exact source tip ([aeb9a26](https://github.com/mokly-ai/mokly/commit/aeb9a26c510621dbc37b1a8a84552ec42bfa2736))
* preserve catalogue state on evidence updates ([#59](https://github.com/mokly-ai/mokly/issues/59)) ([7cefa42](https://github.com/mokly-ai/mokly/commit/7cefa427a1612458c0f9f7f40ed205aa02c12687))
* preserve Usage link focus during updates ([#63](https://github.com/mokly-ai/mokly/issues/63)) ([e0dc6d1](https://github.com/mokly-ai/mokly/commit/e0dc6d10163e79e0b991d1cd25b53778810dffe7))
* publish under the Mokly npm scope ([#67](https://github.com/mokly-ai/mokly/issues/67)) ([bf1f5be](https://github.com/mokly-ai/mokly/commit/bf1f5be35f7296a185081b0cb830e068577eb598))
* publish under the Mokly npm scope ([#69](https://github.com/mokly-ai/mokly/issues/69)) ([5b4c647](https://github.com/mokly-ai/mokly/commit/5b4c647b6138fa08d65a7573f01b1c342ec9b019))
* **review:** preserve function-name boundaries in CSS serialization ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))

## [0.8.0](https://github.com/futex-ai/mokabook/compare/v0.7.1...v0.8.0) (2026-09-11)


### ⚠ BREAKING CHANGES

* remove legacy configuration and exported types, automatic source discovery, comment-component expansion, legacy lint options and route aliases. Consumers must register document pages, preserve explicit routes, and regenerate v4 output through the documented ownership migration. The legacy renderer and raw HTML fixture are intentionally removed; shared change metadata replaces the removed-screen helper without removing screen support.

### Features

* unify catalogue pages and optional published Changes ([#54](https://github.com/futex-ai/mokabook/issues/54)) ([b5065a6](https://github.com/futex-ai/mokabook/commit/b5065a68b5ecb2f3bdc327a26659bcd6d9a3b2ff))


### Bug Fixes

* **server:** allow five-minute watched startup ([#56](https://github.com/futex-ai/mokabook/issues/56)) ([bdb2125](https://github.com/futex-ai/mokabook/commit/bdb212555fb4e01156ead1bcc1a8b38d67876925))


### Performance Improvements

* start large catalogues with on-demand previews ([#57](https://github.com/futex-ai/mokabook/issues/57)) ([aab65ab](https://github.com/futex-ai/mokabook/commit/aab65abcb7ae96e111268cf88ba890c82b0c7d2c))

## [0.7.1](https://github.com/futex-ai/mokabook/compare/v0.7.0...v0.7.1) (2026-09-11)


### Bug Fixes

* **ci:** isolate comparison test baselines ([#51](https://github.com/futex-ai/mokabook/issues/51)) ([4d1fb34](https://github.com/futex-ai/mokabook/commit/4d1fb348589255961c9ca37ee833fdcce9860c1a))

## [0.7.0](https://github.com/futex-ai/mokabook/compare/v0.6.0...v0.7.0) (2026-09-10)


### ⚠ BREAKING CHANGES

* use mokabook serve and select a screen comparison instead of invoking mokabook review or opening a standalone Review report.

### Features

* add consumer static catalogue export ([#49](https://github.com/futex-ai/mokabook/issues/49)) ([a0e349a](https://github.com/futex-ai/mokabook/commit/a0e349a06bac83a1f873d7ee4980b6504ad1cfdf))
* add MockLinks to the Mokabook catalogue ([#46](https://github.com/futex-ai/mokabook/issues/46)) ([93ac778](https://github.com/futex-ai/mokabook/commit/93ac77848993bf1757eceac9387aef485823acf2))
* adopt screen stack logo ([#44](https://github.com/futex-ai/mokabook/issues/44)) ([815405e](https://github.com/futex-ai/mokabook/commit/815405e8206f4db1ae44ef005c04b6a658bceaaa))
* move screen diffs into Changes ([#40](https://github.com/futex-ai/mokabook/issues/40)) ([b1d74a5](https://github.com/futex-ai/mokabook/commit/b1d74a5390341f8fb9a851f3e59f0cb3183e280c))
* **shell:** make navigation resizable ([#38](https://github.com/futex-ai/mokabook/issues/38)) ([b45327a](https://github.com/futex-ai/mokabook/commit/b45327a722e0f16a214005a91692709f7181d481))
* support MockLink child controls ([#42](https://github.com/futex-ai/mokabook/issues/42)) ([f11e516](https://github.com/futex-ai/mokabook/commit/f11e516d144b4616986423ccf3e8ed86095eed21))


### Bug Fixes

* **browse:** preserve collapsed groups across navigation ([#35](https://github.com/futex-ai/mokabook/issues/35)) ([ef66bf2](https://github.com/futex-ai/mokabook/commit/ef66bf219e7a846f5660f55ef6359ae0d07d5823))
* collapse details inspector by default ([#41](https://github.com/futex-ai/mokabook/issues/41)) ([9398ff6](https://github.com/futex-ai/mokabook/commit/9398ff64fb5a115a4aa3a08c910176ebd10d03a3))
* focus Changes on reviewable screen output ([#47](https://github.com/futex-ai/mokabook/issues/47)) ([a5ecbc0](https://github.com/futex-ai/mokabook/commit/a5ecbc06d6169ec4af5329d52b6f13b2cd2f0276))
* **search:** match authored page IDs ([#39](https://github.com/futex-ai/mokabook/issues/39)) ([1dcfb67](https://github.com/futex-ai/mokabook/commit/1dcfb67ce1e058051f5f1d0e76e3042ad9d40cc3))
* **shell:** draw copy and expand as legible icons ([#50](https://github.com/futex-ai/mokabook/issues/50)) ([aa5adea](https://github.com/futex-ai/mokabook/commit/aa5adea1b7d00fbfc4c3c3cf5e95c553635ccd2f))
* **shell:** replace tiny search glyph with a legible search icon ([#43](https://github.com/futex-ai/mokabook/issues/43)) ([bb3a22f](https://github.com/futex-ai/mokabook/commit/bb3a22facae6b98355c4e20effdfd47676f8fdb6))

## [0.6.0](https://github.com/futex-ai/mokabook/compare/v0.5.1...v0.6.0) (2026-08-26)


### Features

* infer breadcrumbs from hierarchy ([#29](https://github.com/futex-ai/mokabook/issues/29)) ([f8aa5fc](https://github.com/futex-ai/mokabook/commit/f8aa5fcfb129fa6602f3b88da2343200f9b64a4a))
* navigate catalogue links through Browse ([#30](https://github.com/futex-ai/mokabook/issues/30)) ([4c3fd17](https://github.com/futex-ai/mokabook/commit/4c3fd17ad4d3a2bd7b42c3c21912dd17ff7e1d14))


### Bug Fixes

* **browse:** persist details before navigation ([#32](https://github.com/futex-ai/mokabook/issues/32)) ([9292dbc](https://github.com/futex-ai/mokabook/commit/9292dbcb4b64a685ec64269d55ac0cbcd57bd483))
* ignore compatibility nav paths in Changed ([#33](https://github.com/futex-ai/mokabook/issues/33)) ([6acfa2a](https://github.com/futex-ai/mokabook/commit/6acfa2a30e4fc920a6daec06ac0a9b4929a0e58e))

## [0.5.1](https://github.com/futex-ai/mokabook/compare/v0.5.0...v0.5.1) (2026-08-11)


### Bug Fixes

* compare branch changes from merge base ([#27](https://github.com/futex-ai/mokabook/issues/27)) ([f2c7dd2](https://github.com/futex-ai/mokabook/commit/f2c7dd26062825b079310438268832324980a882))

## [0.5.0](https://github.com/futex-ai/mokabook/compare/v0.4.0...v0.5.0) (2026-08-07)


### Features

* **example:** dark fragments become readable - dark accent [#7](https://github.com/futex-ai/mokabook/issues/7)fae95 ([c92e6e5](https://github.com/futex-ai/mokabook/commit/c92e6e5d69445309eb633a43ca69c924da34a0a2))
* native light/dark color scheme support ([#26](https://github.com/futex-ai/mokabook/issues/26)) ([c92e6e5](https://github.com/futex-ai/mokabook/commit/c92e6e5d69445309eb633a43ca69c924da34a0a2))


### Bug Fixes

* **browse:** remember details disclosure ([#24](https://github.com/futex-ai/mokabook/issues/24)) ([7e12e79](https://github.com/futex-ai/mokabook/commit/7e12e79115010b62b3a19b002ba1defc8731e1f9))
* **preview:** the static snapshot now rewrites data-fragment-light ([c92e6e5](https://github.com/futex-ai/mokabook/commit/c92e6e5d69445309eb633a43ca69c924da34a0a2))

## [0.4.0](https://github.com/futex-ai/mokabook/compare/v0.3.0...v0.4.0) (2026-07-28)


### Features

* **shell:** add a phone status band ([#21](https://github.com/futex-ai/mokabook/issues/21)) ([48e8007](https://github.com/futex-ai/mokabook/commit/48e8007a31659c2a53d9e9489f5efb36f5900a6c))


### Performance Improvements

* **review:** speed large catalogue loading ([#23](https://github.com/futex-ai/mokabook/issues/23)) ([bd28247](https://github.com/futex-ai/mokabook/commit/bd28247d88405a9cfb5a94efa9d509bec444a9fd))

## [0.3.0](https://github.com/futex-ai/mokabook/compare/v0.2.0...v0.3.0) (2026-07-23)


### Features

* **review:** serve Review at /review in the shell design ([#19](https://github.com/futex-ai/mokabook/issues/19)) ([bf06cbb](https://github.com/futex-ai/mokabook/commit/bf06cbb336d435192902da9f55155c8c2504c019))


### Bug Fixes

* **release:** retry registry propagation ([#16](https://github.com/futex-ai/mokabook/issues/16)) ([c7bbf23](https://github.com/futex-ai/mokabook/commit/c7bbf23429d39f6e1d536b5c23e0e64cf8e83105))
* **review:** keep served artifacts current ([#20](https://github.com/futex-ai/mokabook/issues/20)) ([8fff547](https://github.com/futex-ai/mokabook/commit/8fff547ba05cd5ff542bb03242d7950e61b681d4))

## [0.2.0](https://github.com/futex-ai/mokabook/compare/v0.1.0...v0.2.0) (2026-07-22)


### Features

* add pull request preview deployments ([#12](https://github.com/futex-ai/mokabook/issues/12)) ([37b7dc3](https://github.com/futex-ai/mokabook/commit/37b7dc34190ab076d05f44ab4de334febafdc8df))
* move viewport switch into header ([#11](https://github.com/futex-ai/mokabook/issues/11)) ([d5ee0be](https://github.com/futex-ai/mokabook/commit/d5ee0be162f27ad41bec9e3f12bd57a374f2cff0))


### Bug Fixes

* **browse:** copy IDs without navigation ([#13](https://github.com/futex-ai/mokabook/issues/13)) ([5123150](https://github.com/futex-ai/mokabook/commit/51231500f0c40eb1c72278a7f64ce4d4843cacd7))
* **release:** install before auditing signatures ([#8](https://github.com/futex-ai/mokabook/issues/8)) ([05b95d3](https://github.com/futex-ai/mokabook/commit/05b95d33291a32288397973402e11fb63b385f7c))
* **server:** advance past occupied ports ([#15](https://github.com/futex-ai/mokabook/issues/15)) ([9e416c2](https://github.com/futex-ai/mokabook/commit/9e416c229706df8f9eb0b98876843c37513c6f24))

## 0.1.0 (2026-07-20)


### Features

* **example:** prove the consumer contract against the real Firna stack - ([2b3827e](https://github.com/futex-ai/mokabook/commit/2b3827e7572c85a82696a1cc47d8bdee2e3dc14c))
* establish an app-independent Mokabook framework ([#1](https://github.com/futex-ai/mokabook/issues/1)) ([2b3827e](https://github.com/futex-ai/mokabook/commit/2b3827e7572c85a82696a1cc47d8bdee2e3dc14c))
* rebuild the served Browse shell to the refined Mockbook design from ([2b3827e](https://github.com/futex-ai/mokabook/commit/2b3827e7572c85a82696a1cc47d8bdee2e3dc14c))

## Changelog

All notable changes to Mokabook will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- Rule-level attribution for linked stylesheet changes, with matched styles and
  examined-and-excluded evidence in Details for screen and component catalogues.
  Unrelated or formatting-only rules no longer add consumers to Changes;
  unresolved rules retain conservative impact evidence. Opt-in diagnostics
  include CSS analysis timings.
- Initial app-independent Mokabook package foundation.
- Typed config discovery and public registry/Review authoring helpers.
- Deterministic React-to-static-HTML build and non-mutating output checks.
- Manifest-backed responsive Browse server with transactional watched lifecycle.
- Git-based per-viewport Review artifacts, comparison UI, and ignore normalization.
- Packed ESM, NodeNext, clean-cache npx, themed, and Juno-shaped
  consumer verification.
- Consumer-owned module resolution, legacy exclusions, and a temporary typed
  document compatibility bridge for staged migrations.
- Minimum/release-runtime CI plus release-please and tokenless npm trusted
  publishing automation.
