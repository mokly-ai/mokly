# Changelog

## 0.1.0 (2026-11-21)


### ⚠ BREAKING CHANGES

* **viewer:** check catalogue content at receiver boundaries ([#285](https://github.com/mokly-ai/mokly/issues/285))
* **frame:** extract @mokly/frame and @mokly/model from the viewer ([#286](https://github.com/mokly-ai/mokly/issues/286))
* **viewer:** the in-frame script, its message channel, its wire version, and its page markers are renamed: /mokly-viewer/client/inspector.js becomes /mokly-viewer/client/frame-probe.js, the channel mokly-inspector becomes mokly-frame-probe with wire version 3, and the page markers become template[data-mokly-frame-probe] and data-mokly-frame-probe-link. A page published before this release and a viewer of this release reject each other, so publish each hosted catalogue again with this release.
* The catalogue index is version 9 and the entry detail is version 4. Each index record lists `detailId`. Each detail carries `detailId` and no `deploymentId`, and a removed detail no longer carries `generation`. Static builds write `mokly-viewer/deployment.json`. `@mokly/viewer` exports `EntryDetailV4` instead of `EntryDetailV3`. `readCatalogueIndex` reads version 9 only, and `readEntryDetail` reads version 4 only. Rebuild and republish every catalogue with the matching viewer. Mokly Cloud must accept index version 9.
* keep a component's usage lists in its parent detail ([#223](https://github.com/mokly-ai/mokly/issues/223))
* catalogue index v8 and upload envelope v3. Viewers, hosts, and receivers that read index v7, review.json, or envelope v2 must upgrade. Mokly Cloud adopts the change in its own repository after the release.
* The `mokly` CLI is a native Rust binary. `@mokly/mokly` selects it from the matching `@mokly/native-{target}` package for Linux x64 or ARM64 with glibc 2.28 or newer, macOS 11.0 or newer on x64 or ARM64, or Windows x64. There is no JavaScript CLI fallback, so keep optional dependencies enabled during installation. Mokly supports Node 22.15.0 and later 22.x releases, and Node 24.0.0 and later except 24.14 through 24.18. Node 23 is not supported. The First Rust Core Release section of `docs/protocol/npm-release-notes-formats.md` gives all upgrade steps.
* Use `serve` to browse with watch enabled by default. Use `build` to validate, render every view, and write a static site. Use `publish` to build a private site and upload it. `check`, `export`, and `review` are removed. Run `mokly build --strict --out {temporary-directory}` to validate, and replace `export --out` with `build --out`. `build --watch` and `serve --build` are removed. Use `serve` for development.
* The configuration is the data-only file `mokly.config.json`, and `--config` names another JSON file. TypeScript and JavaScript configuration, `defineConfig`, `componentStylesheets`, `ModuleResolutionConfig`, `ReviewConfig`, `StylesheetRule`, `WatchAction`, `WatchConfig`, and `WatchRule` are removed. Paths resolve from the configuration file. `$componentStylesheets` is the only stylesheet token. Brace alternatives such as `{a,b}` replace extglob matches. Use the shipped `config.schema.json` for editor checks.
* No command writes generated output into the repository. Remove committed `mokly-generated/` output and `.mokly-cache`. `build` writes `mokly-static/` by default, and Git must ignore it. Comparisons render both sides from sources with the installed Mokly version, and a base whose sources fail current validation makes Changes unavailable. `serve`, `build`, and `publish` accept `--base`. There is no committed baseline. Use `movedFrom` to identify an entry that moved with content changes.
* Every screen and component has its own props and optional variants. `defineScreen` and `defineComponent` use `render(props, context)`. Each export contributes one definition, so array exports fail. A Storybook file contributes one component, with its stories as variants. `argTypes` gives control hints only. `definePage` returns one complete document. Prop schemas use a strict JSON Schema 2020-12 profile with closed objects. `ComponentEntryDefinition`, `ComponentProps`, `ComponentRenderContext`, `ComponentVariant`, `ComponentVariantDefinition`, `RegisteredComponent`, and `RegistryDefinition` are removed.
* `@mokly/viewer/server`, `@mokly/viewer/runtime`, `renderViewer`, shell hydration, and embedded bootstrap data are removed. `MoklyViewer` takes `index` and `detail` sources, and `readCatalogueIndex` and `readEntryDetail` replace `readCatalogue`. Catalogues use index v7 and entry detail v2, review results v8, change snapshots v4, and the live descriptor v3, and each reader accepts one version. `@mokly/viewer/data` exports only the path functions, the directory names, the path and link grammar, and the prop schema validators. Import `ColorScheme`, `Viewport`, `MoklyVersionError`, `resolveInstance`, and `InstanceResolution` from `@mokly/viewer`. The viewer now shares the CLI version. Rebuild every published catalogue. Mokly Cloud resets and republishes with the matching viewer, and the upload exchange stays v1.
* Entry `dependencies`, component `ownedDependencies` and `review.sharedImpact` have no effect. Mokly warns and ignores them, and a `--strict` command fails on these warnings. Delete them, and declare component CSS with the component's `stylesheets` field.
* Generated output uses manifest v10, catalogue read model v6 and review result v7. Rebuild and commit `mokly-generated/` output that 0.14.0 or earlier wrote, and regenerate exports. A comparison base that 0.14.0 or earlier built shows Changes as unavailable until the base includes this version. Hosts that embed the viewer need `@mokly/viewer` 0.6.0 to read catalogues from this release.
* Rename `ManifestV9`, `ReviewResultV6` and `ScreenReviewV6` to `ManifestV10`, `ReviewResultV7` and `ScreenReviewV7`. `MoklyVersionError.boundary` can now be `"review"`.
* Use mokly-viewer/ and generations/, ownership v3 and upload v2. Older services reject publication with the documented version error until their receiver and viewer are updated.
* file-path identity and Markdown documents ([#131](https://github.com/mokly-ai/mokly/issues/131))
* Path identity removes id, navPath, entries and entriesDir. Use roots and file-derived paths. Rebuild manifest v8 and consume read model v4, review result v5, disclosure storage v4 and /view/<path>/ URLs. Earlier formats, URLs, ids, disclosure keys and configuration are not read or translated. The release note documents manual migration only.
* defineCollection, collection, and the collection types are removed; place entries with navPath or nested folder(). Generated manifests are schema v6 and the public catalogue read model is v2 (folder nodes, navPath, no collections or ancestors). Rebuild generated output after upgrading.

### Features

* add @mokly/viewer embeddable viewer package ([#76](https://github.com/mokly-ai/mokly/issues/76)) ([d7b0ac3](https://github.com/mokly-ai/mokly/commit/d7b0ac356b9397caf1db4e8c88add161da8c0f1b))
* add co-located entries and screen variants ([ce3da27](https://github.com/mokly-ai/mokly/commit/ce3da27f2c5d9d9c8e7fbb4faf1b9cac5b167a33))
* author screens and components as HTML with YAML front matter ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))
* **browse:** group screen variants ([c1af449](https://github.com/mokly-ai/mokly/commit/c1af44908aabce9b31072796c4f3e5c0f2f4a9cf))
* **browse:** mark changed views ([c956d87](https://github.com/mokly-ai/mokly/commit/c956d877c478d5c98fb2afb24eb3afae84ab4555))
* **browse:** show changed variants ([549ab00](https://github.com/mokly-ai/mokly/commit/549ab00a91b38bbd015715cd77f8951d3ae2d52a))
* classify each changed CSS rule by the elements that it matches ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* declare component CSS with the `stylesheets` field ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* **design:** add the disabled and validation roles ([d4228f9](https://github.com/mokly-ai/mokly/commit/d4228f90b97b2698a1b6bed53ddbdf446d4750c8))
* **desktop:** put the Mac window buttons in the app's top bar ([#397](https://github.com/mokly-ai/mokly/issues/397)) ([1a5d2b2](https://github.com/mokly-ai/mokly/commit/1a5d2b2418b82556afebdaaf35e8506e6c04c79f))
* **desktop:** release from a release pull request with safe Mac updates ([#423](https://github.com/mokly-ai/mokly/issues/423)) ([e75947e](https://github.com/mokly-ai/mokly/commit/e75947e27e580ac7b840f95a65f059d812b36810))
* file-path identity and Markdown documents ([#131](https://github.com/mokly-ai/mokly/issues/131)) ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))
* **frame:** extract @mokly/frame and @mokly/model from the viewer ([#286](https://github.com/mokly-ai/mokly/issues/286)) ([7058b0d](https://github.com/mokly-ai/mokly/commit/7058b0dde3252d0e982a47e030ebc0238c94f3d8))
* give entry details content ids and add a deployment file ([#224](https://github.com/mokly-ai/mokly/issues/224)) ([f93afce](https://github.com/mokly-ai/mokly/commit/f93afceaa1d94de3526c4825cc11708c951678ba))
* keep a component's usage lists in its parent detail ([#223](https://github.com/mokly-ai/mokly/issues/223)) ([0a1d351](https://github.com/mokly-ai/mokly/commit/0a1d351dfae463893117f8a6e433ef01e36fe41b))
* move generated output to manifest v10, catalogue read model v6 and review result v7 ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* read the configuration from mokly.config.json ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))
* rebuild the Mokly backend as a Rust core ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))
* **registry:** add screen variants ([1040175](https://github.com/mokly-ai/mokly/commit/1040175b4480bcec08d37c571102d8bb2c9e4495))
* remove review.json; compare from the index and entry details ([#217](https://github.com/mokly-ai/mokly/issues/217)) ([c65aaef](https://github.com/mokly-ai/mokly/commit/c65aaef6b533cb4a004401f9593169d60b6d92bf))
* remove source-path evidence inputs ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* rename the versioned manifest and review types ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* render comparisons from sources without generated output ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))
* render the Browse shell in the browser from catalogue index v7 ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))
* replace check, export, and review with serve, build, and publish ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))
* replace collections with navigation paths ([#123](https://github.com/mokly-ai/mokly/issues/123)) ([b4314fe](https://github.com/mokly-ai/mokly/commit/b4314fec74ea931862a8ab2afab69d560040396a))
* show previous versions of removed pages and screens ([#98](https://github.com/mokly-ai/mokly/issues/98)) ([a177abd](https://github.com/mokly-ai/mokly/commit/a177abd22da825576a11c7d102232c71b7d83f32))
* simplify generated output and delivery ([#156](https://github.com/mokly-ai/mokly/issues/156)) ([b39d89a](https://github.com/mokly-ai/mokly/commit/b39d89a48b4013c331ac0d20072b1ffb9136c1af))
* **ui:** add the @mokly/ui shared UI package ([#243](https://github.com/mokly-ai/mokly/issues/243)) ([e4c6d2c](https://github.com/mokly-ai/mokly/commit/e4c6d2c850fd26dd10392d061c6c9c2ae5d2af25))
* **ui:** move the controls to @mokly/ui, 2 of 5 ([#251](https://github.com/mokly-ai/mokly/issues/251)) ([7edabc3](https://github.com/mokly-ai/mokly/commit/7edabc306d6983c43824e1425782215e44e0d7f0))
* **ui:** move the inspector to @mokly/ui, 3 of 5 ([#253](https://github.com/mokly-ai/mokly/issues/253)) ([9f68de1](https://github.com/mokly-ai/mokly/commit/9f68de1695320adfec9ef5b112cd7865f313b283))
* **ui:** move the layout and theme to @mokly/ui, 5 of 5 ([#255](https://github.com/mokly-ai/mokly/issues/255)) ([8eb2b9a](https://github.com/mokly-ai/mokly/commit/8eb2b9a0ffc5fd49e15f996e7277fa4237ad46d5))
* **ui:** move the preview views to @mokly/ui, 4 of 5 ([#254](https://github.com/mokly-ai/mokly/issues/254)) ([8c2bbff](https://github.com/mokly-ai/mokly/commit/8c2bbff2c146a2f77f469668e342da127e3e0397))
* **ui:** move the shell chrome to @mokly/ui, 1 of 5 ([#249](https://github.com/mokly-ai/mokly/issues/249)) ([14c6f9e](https://github.com/mokly-ai/mokly/commit/14c6f9ec4c6a328bd90a5cc06481ebf45e409fd9))
* **ui:** use neutral Graphite greys for the dark theme ([#299](https://github.com/mokly-ai/mokly/issues/299)) ([d83859b](https://github.com/mokly-ai/mokly/commit/d83859b90e5c8eb72365d4cf45910152461a59bd))
* use one props and variants model for every entry kind ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))
* **viewer:** add Auto/Light/Dark appearance ([#96](https://github.com/mokly-ai/mokly/issues/96)) ([d4228f9](https://github.com/mokly-ai/mokly/commit/d4228f90b97b2698a1b6bed53ddbdf446d4750c8))
* **viewer:** add comment anchoring primitives ([#84](https://github.com/mokly-ai/mokly/issues/84)) ([adac9e1](https://github.com/mokly-ai/mokly/commit/adac9e1d56549a5ba164bf90508a93fd59d34e44))
* **viewer:** add route-scoped shell bootstraps ([#120](https://github.com/mokly-ai/mokly/issues/120)) ([b2c82c1](https://github.com/mokly-ai/mokly/commit/b2c82c1591c91f2550a66c464833b1f864bdab07))
* **viewer:** adopt the mokly-cloud logo ([#119](https://github.com/mokly-ai/mokly/issues/119)) ([3699c56](https://github.com/mokly-ai/mokly/commit/3699c56619fd9450a001547ffc7e92b9f8536fba))
* **viewer:** align comparison pane scrolling ([#121](https://github.com/mokly-ai/mokly/issues/121)) ([d71b03b](https://github.com/mokly-ai/mokly/commit/d71b03b7dc40710ef8b187beb6a25ea7a07d6fda))
* **viewer:** check catalogue content at receiver boundaries ([#285](https://github.com/mokly-ai/mokly/issues/285)) ([b219642](https://github.com/mokly-ai/mokly/commit/b2196424d384ee9d0313fcafeda4608cca7900f7))
* **viewer:** hide removed entries from the All filter ([#417](https://github.com/mokly-ai/mokly/issues/417)) ([098d108](https://github.com/mokly-ai/mokly/commit/098d1080aa305eb92ab7fd891191c021de464f55))
* **viewer:** hydrate the shared Browse shell ([#95](https://github.com/mokly-ai/mokly/issues/95)) ([b5c9f07](https://github.com/mokly-ai/mokly/commit/b5c9f07dc70290c990f9608fc0d75e58188a50b5))
* **viewer:** present removed previews as viewer-owned documents ([#104](https://github.com/mokly-ai/mokly/issues/104)) ([f23c376](https://github.com/mokly-ai/mokly/commit/f23c376966343a226a8b7e76aee32a784cf08fa4))
* warn on stylesheet renderer seeds and align the docs ([#218](https://github.com/mokly-ai/mokly/issues/218)) ([89c12ef](https://github.com/mokly-ai/mokly/commit/89c12ef1726bd29cd5e8c029e83bbe58dba7e3de))


### Bug Fixes

* align screen variants and history ([#115](https://github.com/mokly-ai/mokly/issues/115)) ([2ec4d83](https://github.com/mokly-ai/mokly/commit/2ec4d837df2c2fdbd74453b5844a36bd9b4272bf))
* **browse:** follow the shown view and share Changes activation ([207277d](https://github.com/mokly-ai/mokly/commit/207277d396782d9a3773802f07670bdae00931b2))
* **browse:** keep view evidence on screen ([8293010](https://github.com/mokly-ai/mokly/commit/82930108290ab886c644085baa0f2a85f53aea08))
* **catalogue:** keep authored variant order and per-view status ([25f734a](https://github.com/mokly-ai/mokly/commit/25f734af72525949a7444e45b76cbe37fface1b7))
* **export:** read only specifiers in scripts ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))
* **graph:** report closure warnings in Serve and previews (finding 1) ([89c12ef](https://github.com/mokly-ai/mokly/commit/89c12ef1726bd29cd5e8c029e83bbe58dba7e3de))
* prevent output write and frame usage races ([#129](https://github.com/mokly-ai/mokly/issues/129)) ([800fe9f](https://github.com/mokly-ai/mokly/commit/800fe9f88a0173429b25baa1bcf41ed9e59b2256))
* **release:** build model before the frame registration archive ([7058b0d](https://github.com/mokly-ai/mokly/commit/7058b0dde3252d0e982a47e030ebc0238c94f3d8))
* **release:** pin viewer initial version ([#78](https://github.com/mokly-ai/mokly/issues/78)) ([65feea8](https://github.com/mokly-ai/mokly/commit/65feea88c876ee79a5bd1feef16705caa66eebbc))
* **shell:** match inspector divider to nav divider ([#90](https://github.com/mokly-ai/mokly/issues/90)) ([9bd6f20](https://github.com/mokly-ai/mokly/commit/9bd6f20ab10cc8fb403de68359de59dd82d94141))
* **ui:** size the preview note by its own text, not the host root font ([#373](https://github.com/mokly-ai/mokly/issues/373)) ([6995b84](https://github.com/mokly-ai/mokly/commit/6995b84b75465f090ef41c6c0ddb768381b7fde8))
* **verification:** name the right command in two errors (finding 5) ([89c12ef](https://github.com/mokly-ai/mokly/commit/89c12ef1726bd29cd5e8c029e83bbe58dba7e3de))
* **viewer:** authenticate frame document handoffs ([#99](https://github.com/mokly-ai/mokly/issues/99)) ([b95ad47](https://github.com/mokly-ai/mokly/commit/b95ad472c04768e777bc8f2d3b0555380f0e8f61))
* **viewer:** keep a working preview ready after an inspection error ([#331](https://github.com/mokly-ai/mokly/issues/331)) ([88b0147](https://github.com/mokly-ai/mokly/commit/88b014719ab47ccf73d09e18f3cb1594f5ba25cc))
* **viewer:** keep stacked narrow frames reachable ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))
* **viewer:** keep the search when a listed row shows the destination ([#306](https://github.com/mokly-ai/mokly/issues/306)) ([760a2c2](https://github.com/mokly-ai/mokly/commit/760a2c2941a706a451e7d010eed8ed7aed5404a6))
* **viewer:** repair embedded stylesheet layout ([#103](https://github.com/mokly-ai/mokly/issues/103)) ([dde661c](https://github.com/mokly-ai/mokly/commit/dde661c7695773170e8c86ee1960bf9e4eab144c))
* **viewer:** resolve effective views ([#112](https://github.com/mokly-ai/mokly/issues/112)) ([d665d06](https://github.com/mokly-ai/mokly/commit/d665d066388a1e21efc0016f32536909e040acdd))
* **viewer:** route asynchronous document failures to the catalogue failure state ([#362](https://github.com/mokly-ai/mokly/issues/362)) ([c2fe4bf](https://github.com/mokly-ai/mokly/commit/c2fe4bf2a4043e315eb888b86542cb44ec93cce0))
* **viewer:** send same-origin cookies from the standalone shell ([#289](https://github.com/mokly-ai/mokly/issues/289)) ([b1c6d6b](https://github.com/mokly-ai/mokly/commit/b1c6d6be46ebe760a3533fec741015d511a284ff))
* **viewer:** wait for slow previews and recover focus after Try again ([#428](https://github.com/mokly-ai/mokly/issues/428)) ([3e09c61](https://github.com/mokly-ai/mokly/commit/3e09c6150e076abb0caead6fa2af8500087aece9))


### Documentation

* present moves in the guides and contracts ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))


### Code Refactoring

* **viewer:** split the in-frame runtime into a core and a wrapper ([7058b0d](https://github.com/mokly-ai/mokly/commit/7058b0dde3252d0e982a47e030ebc0238c94f3d8))
