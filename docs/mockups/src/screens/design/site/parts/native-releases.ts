import type { Release } from "./release";

/** Releases 0.19.0 to 0.16.0, from the native Rust CLI onward. */
export const nativeReleases = [
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.18.0...v0.19.0",
    date: "2026-11-12",
    groups: [
      {
        kind: "breaking",
        notes: [
          "**viewer:** check catalogue content at receiver boundaries ([#285](https://github.com/mokly-ai/mokly/issues/285))",
          "**frame:** extract @mokly/frame and @mokly/model from the viewer ([#286](https://github.com/mokly-ai/mokly/issues/286))",
          "**viewer:** the in-frame script, its message channel, its wire version, and its page markers are renamed: /mokly-viewer/client/inspector.js becomes /mokly-viewer/client/frame-probe.js, the channel mokly-inspector becomes mokly-frame-probe with wire version 3, and the page markers become template[data-mokly-frame-probe] and data-mokly-frame-probe-link. A page published before this release and a viewer of this release reject each other, so publish each hosted catalogue again with this release.",
        ],
      },
      {
        kind: "features",
        notes: [
          "**frame:** extract @mokly/frame and @mokly/model from the viewer ([#286](https://github.com/mokly-ai/mokly/issues/286)) ([7058b0d](https://github.com/mokly-ai/mokly/commit/7058b0dde3252d0e982a47e030ebc0238c94f3d8))",
          "**html:** name warning sources and point prop errors at source ([6508b95](https://github.com/mokly-ai/mokly/commit/6508b9505e64eda3e7460a2b3c344f6258c086b5))",
          "**viewer:** check catalogue content at receiver boundaries ([#285](https://github.com/mokly-ai/mokly/issues/285)) ([b219642](https://github.com/mokly-ai/mokly/commit/b2196424d384ee9d0313fcafeda4608cca7900f7))",
        ],
      },
      {
        kind: "fixes",
        notes: [
          "**cli:** exit watched Serve when its terminal closes ([#287](https://github.com/mokly-ai/mokly/issues/287)) ([a051315](https://github.com/mokly-ai/mokly/commit/a051315224d83e16b935706859d13dc9c68f3ed5))",
          "**compare:** hint every scripts-off base failure and skip pnpm prompts ([7d0682a](https://github.com/mokly-ai/mokly/commit/7d0682af43baf4ab2dfa5c4e31537aeddcdfb893))",
          "**css:** finish the approved CSS Modules scanner follow-ups ([9e57d86](https://github.com/mokly-ai/mokly/commit/9e57d8610b1996415a1415c44dab26efac4d8bbc))",
          "**deps:** update pulldown-cmark to 0.13.6 ([#282](https://github.com/mokly-ai/mokly/issues/282)) ([0e3c8e8](https://github.com/mokly-ai/mokly/commit/0e3c8e81a0d0f7d6772ec8f3474d78d46d96028b))",
          "keep the publish token out of output, viewer URLs, and sidecars ([e09bb3b](https://github.com/mokly-ai/mokly/commit/e09bb3ba6e46abdbba836227a2a149cc838f8b9a))",
          "**large:** restart the build deadline on each output line ([c7e7d9b](https://github.com/mokly-ai/mokly/commit/c7e7d9b88efc84152eb33539ed8ed7ca2ad2bb93))",
          "plain Windows paths, cache check form, base link names, test Git ([db48e47](https://github.com/mokly-ai/mokly/commit/db48e47386f125c229f30810ef23c0965919818b))",
          "**platform:** stop escaped script process trees on Unix ([1ac39fa](https://github.com/mokly-ai/mokly/commit/1ac39faf11f8ea8ba2c16db02aae3406af3518ba))",
          "**release:** build model before the frame registration archive ([7058b0d](https://github.com/mokly-ai/mokly/commit/7058b0dde3252d0e982a47e030ebc0238c94f3d8))",
          "**render:** key environments without the checkout folder ([3378cb3](https://github.com/mokly-ai/mokly/commit/3378cb3ba3cf49785d6317c5b85541375380f343))",
          "**viewer:** send same-origin cookies from the standalone shell ([#289](https://github.com/mokly-ai/mokly/issues/289)) ([b1c6d6b](https://github.com/mokly-ai/mokly/commit/b1c6d6be46ebe760a3533fec741015d511a284ff))",
          "**watch:** recover lost macOS and Windows events ([5529023](https://github.com/mokly-ai/mokly/commit/5529023c365c927ca44ce71499435e2c82b21e13))",
        ],
      },
      {
        kind: "performance",
        notes: [
          "**compare:** keep compact owned proof candidates ([6e02b32](https://github.com/mokly-ai/mokly/commit/6e02b32ddb88f3db6bf0ae1b9da44cba2a11e038))",
          "**serve:** share one verified copy among concurrent asset requests ([d148edc](https://github.com/mokly-ai/mokly/commit/d148edc50d21bb9eed756751f5b3429aba5e36be))",
          "**sidecar:** retain the last released compiled recipes ([2ca5774](https://github.com/mokly-ai/mokly/commit/2ca5774254aa30e9dfe33edee679fd0eae1abf57))",
        ],
      },
      {
        kind: "refactoring",
        notes: [
          "**viewer:** split the in-frame runtime into a core and a wrapper ([7058b0d](https://github.com/mokly-ai/mokly/commit/7058b0dde3252d0e982a47e030ebc0238c94f3d8))",
        ],
      },
    ],
    version: "0.19.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.17.0...v0.18.0",
    date: "2026-11-01",
    groups: [
      {
        kind: "breaking",
        notes: [
          "The catalogue index is version 9 and the entry detail is version 4. Each index record lists `detailId`. Each detail carries `detailId` and no `deploymentId`, and a removed detail no longer carries `generation`. Static builds write `mokly-viewer/deployment.json`. `@mokly/viewer` exports `EntryDetailV4` instead of `EntryDetailV3`. `readCatalogueIndex` reads version 9 only, and `readEntryDetail` reads version 4 only. Rebuild and republish every catalogue with the matching viewer. Mokly Cloud must accept index version 9.",
        ],
      },
      {
        kind: "features",
        notes: [
          "**cli:** show comparison steps while Changes loads ([#248](https://github.com/mokly-ai/mokly/issues/248)) ([afc9f58](https://github.com/mokly-ai/mokly/commit/afc9f58d20f3312cc9d73ceae55e270ed46dfe08))",
          "**dev:** install and build before npm run dev serves ([#250](https://github.com/mokly-ai/mokly/issues/250)) ([e9c2022](https://github.com/mokly-ai/mokly/commit/e9c20225af1b203bea236d29869c48f8c103668b))",
          "give entry details content ids and add a deployment file ([#224](https://github.com/mokly-ai/mokly/issues/224)) ([f93afce](https://github.com/mokly-ai/mokly/commit/f93afceaa1d94de3526c4825cc11708c951678ba))",
          "**ui:** move the controls to @mokly/ui, 2 of 5 ([#251](https://github.com/mokly-ai/mokly/issues/251)) ([7edabc3](https://github.com/mokly-ai/mokly/commit/7edabc306d6983c43824e1425782215e44e0d7f0))",
          "**ui:** move the inspector to @mokly/ui, 3 of 5 ([#253](https://github.com/mokly-ai/mokly/issues/253)) ([9f68de1](https://github.com/mokly-ai/mokly/commit/9f68de1695320adfec9ef5b112cd7865f313b283))",
          "**ui:** move the layout and theme to @mokly/ui, 5 of 5 ([#255](https://github.com/mokly-ai/mokly/issues/255)) ([8eb2b9a](https://github.com/mokly-ai/mokly/commit/8eb2b9a0ffc5fd49e15f996e7277fa4237ad46d5))",
          "**ui:** move the preview views to @mokly/ui, 4 of 5 ([#254](https://github.com/mokly-ai/mokly/issues/254)) ([8c2bbff](https://github.com/mokly-ai/mokly/commit/8c2bbff2c146a2f77f469668e342da127e3e0397))",
          "**ui:** move the shell chrome to @mokly/ui, 1 of 5 ([#249](https://github.com/mokly-ai/mokly/issues/249)) ([14c6f9e](https://github.com/mokly-ai/mokly/commit/14c6f9ec4c6a328bd90a5cc06481ebf45e409fd9))",
        ],
      },
      {
        kind: "fixes",
        notes: [
          "**deps:** select patched minimatch for lint and release tools ([21c8663](https://github.com/mokly-ai/mokly/commit/21c86638f7719fa799eec11e3f39215c8ce98552))",
          "**graph:** carry unchanged public closures across replacements ([#244](https://github.com/mokly-ai/mokly/issues/244)) ([bb33139](https://github.com/mokly-ai/mokly/commit/bb33139552da58a3f69c52c418322821ceb9536a))",
        ],
      },
      {
        kind: "performance",
        notes: [
          "**render:** reuse stylesheet bundles with shared module evidence ([#242](https://github.com/mokly-ai/mokly/issues/242)) ([ee7d8ea](https://github.com/mokly-ai/mokly/commit/ee7d8ea739bd103aacd001f8e75e5aa144929348))",
        ],
      },
    ],
    version: "0.18.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.16.1...v0.17.0",
    date: "2026-10-29",
    groups: [
      {
        kind: "breaking",
        notes: [
          "keep a component's usage lists in its parent detail ([#223](https://github.com/mokly-ai/mokly/issues/223))",
          "catalogue index v8 and upload envelope v3. Viewers, hosts, and receivers that read index v7, review.json, or envelope v2 must upgrade. Mokly Cloud adopts the change in its own repository after the release.",
        ],
      },
      {
        kind: "features",
        notes: [
          "**html:** share one HTML driver between checks and trees ([#239](https://github.com/mokly-ai/mokly/issues/239)) ([02eec93](https://github.com/mokly-ai/mokly/commit/02eec9371e2cf46ef0dd075cb246b80e3826c9c9))",
          "keep a component's usage lists in its parent detail ([#223](https://github.com/mokly-ai/mokly/issues/223)) ([0a1d351](https://github.com/mokly-ai/mokly/commit/0a1d351dfae463893117f8a6e433ef01e36fe41b))",
          "**publish:** send gzip Blob bodies when the receiver lists gzip ([#221](https://github.com/mokly-ai/mokly/issues/221)) ([2dd2937](https://github.com/mokly-ai/mokly/commit/2dd2937f22b1671123a62cd51e2a11a536617b03))",
          "remove review.json; compare from the index and entry details ([#217](https://github.com/mokly-ai/mokly/issues/217)) ([c65aaef](https://github.com/mokly-ai/mokly/commit/c65aaef6b533cb4a004401f9593169d60b6d92bf))",
          "**ui:** add the @mokly/ui shared UI package ([#243](https://github.com/mokly-ai/mokly/issues/243)) ([e4c6d2c](https://github.com/mokly-ai/mokly/commit/e4c6d2c850fd26dd10392d061c6c9c2ae5d2af25))",
          "warn on stylesheet renderer seeds and align the docs ([#218](https://github.com/mokly-ai/mokly/issues/218)) ([89c12ef](https://github.com/mokly-ai/mokly/commit/89c12ef1726bd29cd5e8c029e83bbe58dba7e3de))",
        ],
      },
      {
        kind: "fixes",
        notes: [
          "**config:** give config-relative paths one normalized form ([#240](https://github.com/mokly-ai/mokly/issues/240)) ([843ac8b](https://github.com/mokly-ai/mokly/commit/843ac8bf0ec2b1a91fa21b57231591d96e6844cd))",
          "**css:** align CSS Modules scanners with cssparser (user item 111 C) ([#241](https://github.com/mokly-ai/mokly/issues/241)) ([c9d402c](https://github.com/mokly-ai/mokly/commit/c9d402cdfa5f0c8301be67e8d46868854164a9f6))",
          "**deps:** update pulldown-cmark to 0.13.5 ([#230](https://github.com/mokly-ai/mokly/issues/230)) ([9f78200](https://github.com/mokly-ai/mokly/commit/9f78200e3f85ce000cac34769bd0d317dfd43731))",
          "**git:** read unreadable extraction files through Git ([#237](https://github.com/mokly-ai/mokly/issues/237)) ([3ea78c0](https://github.com/mokly-ai/mokly/commit/3ea78c0b4cc55051668fd75afb3b40f6927bec6c))",
          "**graph:** key unattributed definitions and unnamed previews exactly ([#235](https://github.com/mokly-ai/mokly/issues/235)) ([c92c1a7](https://github.com/mokly-ai/mokly/commit/c92c1a7f7787bffd18c3598b7f439b3243daf012))",
          "**graph:** report closure warnings in Serve and previews (finding 1) ([89c12ef](https://github.com/mokly-ai/mokly/commit/89c12ef1726bd29cd5e8c029e83bbe58dba7e3de))",
          "**postcss:** keep the paths of hook-supplied modules ([#238](https://github.com/mokly-ai/mokly/issues/238)) ([10dd5a0](https://github.com/mokly-ai/mokly/commit/10dd5a01a88c0b47f18ee16ba2587f2dc439bcf6))",
          "**verification:** name the right command in two errors (finding 5) ([89c12ef](https://github.com/mokly-ai/mokly/commit/89c12ef1726bd29cd5e8c029e83bbe58dba7e3de))",
        ],
      },
      {
        kind: "performance",
        notes: [
          "**build:** capture head documents once during the build check ([#220](https://github.com/mokly-ai/mokly/issues/220)) ([a9dd1e8](https://github.com/mokly-ai/mokly/commit/a9dd1e81562c4acaacec4a512967c38d1db80de3))",
          "**compare:** read base files from the leased extraction ([#236](https://github.com/mokly-ai/mokly/issues/236)) ([aab537b](https://github.com/mokly-ai/mokly/commit/aab537bdf0aca61eb731d258c2f54c51bda0e316))",
          "**git:** convert base batches in one Git process, time the extraction ([#229](https://github.com/mokly-ai/mokly/issues/229)) ([d4c6f6a](https://github.com/mokly-ai/mokly/commit/d4c6f6a825dc73af66e8df524d67e7f6d876a547))",
          "**graph:** bundle stylesheet roots in parallel ([#228](https://github.com/mokly-ai/mokly/issues/228)) ([c83becc](https://github.com/mokly-ai/mokly/commit/c83beccfcfbc36a503c681a2a59c9a08f0596b74))",
          "per-entry render keys and cross-side render reuse ([#227](https://github.com/mokly-ai/mokly/issues/227)) ([9ce7585](https://github.com/mokly-ai/mokly/commit/9ce7585394f36c01aa54cd2a274f2d46fd672d6b))",
          "**serve:** render the background pass in bounded batches ([#225](https://github.com/mokly-ai/mokly/issues/225)) ([9c56286](https://github.com/mokly-ai/mokly/commit/9c56286d1bb89096f24392ba7a3c955cbf816f3c))",
          "**serve:** smaller cache charges, cache counts, covered-root recheck ([#222](https://github.com/mokly-ai/mokly/issues/222)) ([140bb0e](https://github.com/mokly-ai/mokly/commit/140bb0ef8fbfa3d048303b70588d2a8c5cfd86a4))",
          "**sidecar:** resolve bundle imports natively and plan a second compile ([#226](https://github.com/mokly-ai/mokly/issues/226)) ([3192b19](https://github.com/mokly-ai/mokly/commit/3192b19b9060f0905d9f573784bce787b4f3707c))",
        ],
      },
    ],
    version: "0.17.0",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.16.0...v0.16.1",
    date: "2026-10-26",
    groups: [
      {
        kind: "fixes",
        notes: [
          "**release:** verify native packages of other platforms ([#207](https://github.com/mokly-ai/mokly/issues/207)) ([66e1ba6](https://github.com/mokly-ai/mokly/commit/66e1ba6afa936d01689a33fd6f1e2d69f983eb47))",
        ],
      },
    ],
    version: "0.16.1",
  },
  {
    compare: "https://github.com/mokly-ai/mokly/compare/v0.15.0...v0.16.0",
    date: "2026-10-25",
    groups: [
      {
        kind: "breaking",
        notes: [
          "The `mokly` CLI is a native Rust binary. `@mokly/mokly` selects it from the matching `@mokly/native-{target}` package for Linux x64 or ARM64 with glibc 2.28 or newer, macOS 11.0 or newer on x64 or ARM64, or Windows x64. There is no JavaScript CLI fallback, so keep optional dependencies enabled during installation. Mokly supports Node 22.15.0 and later 22.x releases, and Node 24.0.0 and later except 24.14 through 24.18. Node 23 is not supported. The [upgrade guide](docs/guides/start/upgrade.md) gives all upgrade steps.",
          "Use `serve` to browse with watch enabled by default. Use `build` to validate, render every view, and write a static site. Use `publish` to build a private site and upload it. `check`, `export`, and `review` are removed. Run `mokly build --strict --out {temporary-directory}` to validate, and replace `export --out` with `build --out`. `build --watch` and `serve --build` are removed. Use `serve` for development.",
          "The configuration is the data-only file `mokly.config.json`, and `--config` names another JSON file. TypeScript and JavaScript configuration, `defineConfig`, `componentStylesheets`, `ModuleResolutionConfig`, `ReviewConfig`, `StylesheetRule`, `WatchAction`, `WatchConfig`, and `WatchRule` are removed. Paths resolve from the configuration file. `$componentStylesheets` is the only stylesheet token. Brace alternatives such as `{a,b}` replace extglob matches. Use the shipped `config.schema.json` for editor checks.",
          "No command writes generated output into the repository. Remove committed `mokly-generated/` output and `.mokly-cache`. `build` writes `mokly-static/` by default, and Git must ignore it. Comparisons render both sides from sources with the installed Mokly version, and a base whose sources fail current validation makes Changes unavailable. `serve`, `build`, and `publish` accept `--base`. There is no committed baseline. Use `movedFrom` to identify an entry that moved with content changes.",
          "Every screen and component has its own props and optional variants. `defineScreen` and `defineComponent` use `render(props, context)`. Each export contributes one definition, so array exports fail. A Storybook file contributes one component, with its stories as variants. `argTypes` gives control hints only. `definePage` returns one complete document. Prop schemas use a strict JSON Schema 2020-12 profile with closed objects. `ComponentEntryDefinition`, `ComponentProps`, `ComponentRenderContext`, `ComponentVariant`, `ComponentVariantDefinition`, `RegisteredComponent`, and `RegistryDefinition` are removed.",
          "`@mokly/viewer/server`, `@mokly/viewer/runtime`, `renderViewer`, shell hydration, and embedded bootstrap data are removed. `MoklyViewer` takes `index` and `detail` sources, and `readCatalogueIndex` and `readEntryDetail` replace `readCatalogue`. Catalogues use index v7 and entry detail v2, review results v8, change snapshots v4, and the live descriptor v3, and each reader accepts one version. `@mokly/viewer/data` exports only the path functions, the directory names, the path and link grammar, and the prop schema validators. Import `ColorScheme`, `Viewport`, `MoklyVersionError`, `resolveInstance`, and `InstanceResolution` from `@mokly/viewer`. The viewer now shares the CLI version. Rebuild every published catalogue. Mokly Cloud resets and republishes with the matching viewer, and the upload exchange stays v1.",
        ],
      },
      {
        kind: "features",
        notes: [
          "author screens and components as HTML with YAML front matter ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))",
          "read the configuration from mokly.config.json ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))",
          "rebuild the Mokly backend as a Rust core ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))",
          "render comparisons from sources without generated output ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))",
          "render the Browse shell in the browser from catalogue index v7 ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))",
          "replace check, export, and review with serve, build, and publish ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))",
          "use one props and variants model for every entry kind ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))",
        ],
      },
      {
        kind: "fixes",
        notes: [
          "**deps:** resolve dependency audit findings ([#200](https://github.com/mokly-ai/mokly/issues/200)) ([12681c8](https://github.com/mokly-ai/mokly/commit/12681c8ba03061f457bdb58952edf1bec16d9828))",
        ],
      },
    ],
    upgrade: [
      "#### First Rust Core Release",
      "The first Rust core release is a breaking 0.x minor release. Install `@mokly/mokly`; npm selects its matching viewer and native dependencies. Rebuild all published catalogues. No compatibility reader or converter exists for older configuration, authoring modules, generated output, or caches.",
      "##### Commands And Configuration",
      "- Use `serve` to browse with watch enabled by default. Use `build` to validate, render every view, and write a static site. `publish` builds a private site and uploads it. `check`, `export`, and `review` are absent. For validation, run `mokly build --strict --out {temporary-directory}`. Replace `export --out` with `build --out`. `build --watch` and `serve --build` are absent; use watched Serve for development.",
      '- Configuration is data-only `mokly.config.json`. `--config` names another JSON file. TypeScript and JavaScript configuration and `defineConfig` are absent. Use the shipped `config.schema.json` for editor checks. Filesystem paths are relative to the configuration file. `$componentStylesheets` is the only stylesheet token. Replace the `componentStylesheets` JavaScript export with this token in the JSON stylesheet list. `WatchConfig` and `ReviewConfig` are removed configuration types. Replace extglob stylesheet matches such as `@(a|b)` with brace alternatives such as `{a,b}`. Unsupported extglob matchers emit a `stylesheet-extglob` configuration warning that names the pattern and suggests brace alternatives. `--strict` fails on this warning under the normal build-warning policy. Replace flat generated-filename matches with entry routes such as `product/**/index.html`. Local stylesheet paths resolve from the JSON file. Remove `.css: "text"` loader overrides. Import CSS normally so the core delivers its stylesheet and referenced assets.',
      "- Do not commit generated output. `build` defaults to `mokly-static/`, which must be ignored by Git. Remove committed `mokly-generated/` output and `.mokly-cache`. Serve and comparisons render in memory. Base extraction and dependency caches use the operating system's cache directory.",
      "- `serve`, `build`, and `publish` accept `--base`. `build` and `publish` accept `--no-changes`. Publish has no `--out`; it names its private build directory before building and keeps it after a failed upload. Publish requires a clean, committed checkout. Static output requires an empty directory or its valid ownership marker.",
      "- `build` fingerprints only what the build uses: the configuration, root membership, inventoried sources, and the files that rendering reaches. An edit to an unrelated repository file does not stop a build. Some edits made while a build runs are not detected. These are edits to JavaScript modules that Mokly bundles from `node_modules`, to files under `node_modules` that a PostCSS plugin reports, to `.gitignore` or the Git index, to ancestor `tsconfig.json` files, to ancestor `package.json` files that PostCSS module resolution does not name, to missing resolution candidates, to the file list of a directory that a PostCSS plugin reports, to files that a PostCSS plugin reads without reporting them, and to files that render callbacks read without an import. These include an installed stylesheet that a PostCSS plugin inlines. Edits to installed stylesheets that Mokly resolves itself, their `url()` assets, the `package.json` files that this resolution reads, PostCSS plugin modules, and the package manifests that PostCSS module resolution names stop the build. A PostCSS plugin can also read a file that it reports in a way that Mokly cannot observe, such as through a native addon. For a reported repository file outside `node_modules`, Mokly records its digest after the read and does not detect an edit between the two. Such output is consistent but stale. Build again after such an edit. `publish` checks the repository status again before upload and rejects an edit to any file that Git does not ignore.",
      "##### Platforms And JavaScript",
      "The npm shim selects one version-matched Rust binary. Supported targets are Linux x64 and ARM64 with glibc 2.28 or newer, macOS 11.0 or newer on x64 and ARM64, and Windows x64 with MSVC. The binary uses the supported Node runtime's OS floor. Windows links its C runtime statically and needs no separate Visual C++ runtime. There is no JavaScript CLI fallback. Keep optional dependencies enabled during installation. Mokly supports Node `>=22.15.0 <23.0.0 || >=24.0.0 <24.14.0 || >=24.19.0`; the shim rejects unsupported versions before binary lookup.",
      "HTML-only catalogues need no JavaScript sidecar. React and Storybook authoring, page callbacks, and consumer PostCSS start sidecars as needed. React and React DOM come from the consumer. The sidecar bundles JavaScript; the Rust core owns CSS Modules, document assembly, caching, and invalidation.",
      "##### Authoring And Comparison",
      "HTML screens and components use leading YAML front matter. Their bodies share `{{name}}`, `$name`, `mokly-if`, and `mokly-viewport`. Components can declare slots. Complete HTML pages and YAML use cases need no JavaScript.",
      "Every screen and component has its own props and optional variants. A variant replaces top-level prop keys. `defineScreen` and `defineComponent` use `render(props, context)`, with `context` containing `viewport` and `colorScheme`. Each export contributes one definition; array exports fail. A Storybook file contributes one component, with its stories as variants and their args as props. `argTypes` supplies control hints and does not define validation. `definePage` returns one complete synchronous document.",
      "Replace uses of a registration's `.entries` with its definition. Update code that indexes exported arrays or reads `id`, `navPath`, or `variantOf` from renderer input. Keep instance names separate from entry paths: `moklyInstance` uses lowercase kebab-case and cannot contain path separators.",
      "Renderer modules return a React node or `{ node, resources }`. Their input has `props` and an entry address with `kind`, `path`, and `title`. The core assembles the document and stylesheet links. Put theme attributes and `lang` on the renderer's wrapper element. Update CSS selectors that depend on consumer attributes on `html` or `body`. Pass caller-specific values, such as a palette, through declared component props. Each component render establishes its own providers; arbitrary caller React context does not cross that boundary.",
      "Prop schemas use the strict JSON Schema 2020-12 profile. Object schemas must be closed with `additionalProperties: false`. Defaults, references, and unsupported keywords fail. The schema can be inferred where the entry contract permits it. Non-data values are excluded with a warning. See [entry props](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-entry-props.md). Supply valid parent props as well as variant props. Move saved React slot content into each variant's `slots` field. At registered instance boundaries, omit absent optional data keys instead of passing `undefined`, including inside nested objects. Keep generic input helpers aligned with the public schema-inference types and check them against the installed declarations. Keep catalogue fixture data in the consumer source tree instead of importing internal fixture files from the installed CLI package.",
      "Comparisons render both sides from sources with the installed Mokly version. A base whose sources fail current validation makes Changes unavailable with those diagnostics. Base JavaScript reuses identical-lockfile dependencies, installs a differing lockfile into the bounded cache with lifecycle scripts disabled, or warns and uses working-tree dependencies if installation fails. There is no committed baseline output. Entry paths derive from files; use `movedFrom` to identify an entry moved with content changes.",
      "Tree comparison removes ignored regions and head styles before materiality checks. Changed CSS contributes rule evidence through selector matching. Source dependency declarations do not determine Changes. Instance and slot markers remain in delivered documents for inspection. Ignore and logical-link markers are consumed during composition.",
      "Component parents render their own views from their props. Static Changes captures both sides of pages and Markdown documents and their resources. Configured CSS uses `styles/{repository-relative stylesheet path}` under `static/mokly-generated/`; referenced authored files use their repository paths under `static/`. Base snapshots include the same generated delivery roots as current output. Rewrite authored relative URLs so they resolve from the document route to `static/{repository path}`.",
      "Schema, control, and declared-slot metadata changes list the component parent. Variants keep independent metadata, props, and supplied-slot changes. A shared schema edit alone does not add one Changes row per variant.",
      "Caller-owned component props remain material when the rendered HTML is equal. Review records keep every applicable reason, including both `inputs` and `material`. The view's `ignoredIds` lists every paired region used for equality, including equal regions in unchanged views. React-generated accessibility IDs can change after structural edits. Those attribute changes can supply actual-instance implementation evidence even when the component's saved views stay unchanged.",
      "CSS evidence names delivered resource routes. Unowned head-style edits use per-rule records at the containing public document route. A removed view keeps matched and conservative rule records from its available before-side tree. Missing entries use their `added` or `removed` reason; `material` describes a paired view's canonical-form change.",
      "A use case has no views, so its review aggregate stays `unchanged` while its screen reasons independently include it in Changes.",
      "Affected-consumer chains start inside that consumer. They omit its own instance and outer ancestors; each context keeps its side and variant address.",
      "##### Viewer And Wire Formats",
      "The Browse shell renders in the browser. Serve and static builds deliver the same shell stub, catalogue index v7, and entry detail v2. Review results use v8, change snapshots use v4, and the live descriptor uses v3. Readers accept one version only. The [format inventory](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-format-versions.md) owns all numbers.",
      "Use the viewer's root, `./browser`, `./data`, and `./styles.css` entries. The `./server` and `./runtime` entries, `renderViewer`, shell hydration, and embedded bootstrap data are absent. `./data` exports only the path functions, the directory names, the path and link grammar, and the prop schema validators. `MoklyViewer` takes index and detail sources. `readCatalogueIndex` and `readEntryDetail` read those boundaries. `resolveInstance` and `InstanceResolution` are available only from `@mokly/viewer`; remove imports of them from `@mokly/mokly`. The index has one revision and a document key per document; updates refresh affected frames without reloading the page. Serve sends no cross-origin response headers.",
      "Mokly Cloud must reset and republish its catalogue with the matching viewer and receiver. The Plan, Blob, Complete upload exchange remains v1; its validation rules and content-delta behavior do not change.",
      "##### Deep Trees And Scale Tools",
      "HTML trees use explicit work stacks for composition, repair, serialization, cloning, equality, and destruction. They need no enlarged thread stack. `plaintext` has no synthetic closing tag. Its parsed tree is the stable browser repair of the serialized payload, including formatting clones and foster-parented content. Initial newlines in `pre`, `textarea`, and `listing` survive repeated parsing.",
      "The opt-in large fixture has native HTML and React variants. Component parent views and Markdown documents give 5,850 documents across 1,620 routes. Generated output is ignored. One Markdown document per area exercises Markdown rendering in both colour schemes. The harness uses the Rust CLI and records build, Serve, Changes, and watch measurements. Workspace reuse and isolated installs are distinct modes. The opt-in benchmark enforces the [approved release startup budgets](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-timings.md#budgets). Automated correctness tests have no wall-clock assertions.",
      "#### Rust Rebuild",
      "The first Rust core release is a breaking 0.x minor release. The [complete upgrade note](#first-rust-core-release) covers native targets, removed commands, JSON configuration, HTML authoring, source comparisons, caches, formats, and the required Mokly Cloud reset.",
      "JSON configuration removes `defineConfig`, `componentStylesheets`, `ModuleResolutionConfig`, `ReviewConfig`, `StylesheetRule`, `WatchAction`, `WatchConfig`, and `WatchRule`. The unified authoring model removes `ComponentEntryDefinition`, `ComponentProps`, `ComponentRenderContext`, `ComponentVariant`, `ComponentVariantDefinition`, `RegisteredComponent`, and `RegistryDefinition`. The CLI also stops exporting `ComponentInstanceRecord`, `ComponentPropsData`, `ComponentResourceOwnership`, `ComponentSourceLocation`, `ComponentStyleOwnership`, `PropPrimitive`, and `PropValue`. Use the current entry props and viewer records. Import `resolveInstance` and `InstanceResolution` only from `@mokly/viewer`.",
      "#### Viewer Delivery",
      "The Browse shell renders only in the browser, from the catalogue index v7 and one entry detail v2 per entry under the [shell delivery contract](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-shell-delivery.md). `@mokly/viewer/server` and `@mokly/viewer/runtime` are removed, and `@mokly/viewer/browser` mounts the standalone shell without `hydrateMoklyShell`. `MoklyViewer` takes an `index` source and a `detail` source and has no `viewerId`. `readCatalogueIndex` and `readEntryDetail` replace `readCatalogue`; `IndexSource`, `DetailSource` and `DetailResult` replace `CatalogueSource` and `CatalogueFetcher`. Prop schemas follow the JSON Schema profile of the [entry props contract](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-entry-props.md): `PropSchema` and `validatePropSchema` replace `ObjectPropSchema`, `DataPropSchema`, `DataPropField`, `InferProp` and `ControlFor`. `@mokly/viewer/data` no longer exports `parseStaticDelivery`, `StaticDelivery`, `StaticDeliveryParseResult` or `RenderCapability`; the standalone shell reads the live descriptor v3.",
      "#### Viewer Data",
      "`@mokly/viewer/data` exports only the path functions, the directory names, the path and link grammar, and the prop schema validators that the [viewer contract](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-viewer.md) lists. Review result v8 replaces the review v7 and manifest types, so the entry no longer exports them or their readers and helpers. Import `ColorScheme`, `Viewport`, and `MoklyVersionError` from `@mokly/viewer`. The entry also stops exporting `AffectedConsumer`, `AffectedUsageEvidence`, `ArtifactView`, `CatalogueHierarchy`, `ChangedEntry`, `ComponentControl`, `ComponentControlLabel`, `ComponentRenderError`, `ComponentRenderRequest`, `ComponentRenderSuccess`, `ComponentReview`, `ComponentUsageContext`, `ComponentValidationError`, `ComponentVariantReview`, `DataBudget`, `DependencyReason`, `EntryChangeReason`, `ExcludedResource`, `GeneratedComponentView`, `HierarchyEntry`, `HierarchyFolder`, `HierarchyNode`, `HistoricalManifest`, `HistoricalManifestEntry`, `HistoricalManifestPage`, `HistoricalManifestScreen`, `HistoricalManifestUseCase`, `HistoricalSnapshotSource`, `HtmlSourceLocation`, `LogicalTarget`, `Manifest`, `ManifestDocument`, `ManifestEntry`, `ManifestEntryBase`, `ManifestFolder`, `ManifestPage`, `ManifestScreen`, `ManifestV10`, `RemovedPagePreview`, `RemovedPagePreviewArtifact`, `ReservedAttributeName`, `ReservedAttributeOccurrence`, `ResolvedCatalogueEntry`, `ReviewArtifact`, `ReviewArtifactContent`, `ReviewEntryAddress`, `ReviewResult`, `ReviewResultV7`, `ReviewState`, `ReviewVariantAddress`, `ScreenResourceEvidence`, `ScreenReview`, `ScreenReviewV7`, `VIEWPORTS`, `ViewResourceEvidence`, `ViewReview`, `affectedConsumerOrderKey`, `analyzeHierarchy`, `canonicalJson`, `catalogueComponentVariants`, `compareNavigationNodes`, `comparisonGeneration`, `comparisonPath`, `counter`, `currentCatalogueEntries`, `decodeProps`, `decodeValue`, `duplicateReservedAttributeName`, `effectiveColorSchemes`, `encodeProps`, `encodeUrlPath`, `exactKeys`, `firstPathCaseCollision`, `fragmentViews`, `generatedViews`, `historicalSnapshotId`, `instanceKey`, `invalidData`, `isHistoricalSnapshotId`, `isKebabCase`, `isManifestComponentVariant`, `isPortableUrlPath`, `isSafeCatalogueRoute`, `isSafeRepositoryPath`, `isStylesheetPath`, `lexical`, `logicalMarker`, `parseBrowsingTarget`, `parseLogicalMarker`, `parseLogicalTarget`, `parseRemovedPagePreview`, `parseReviewResult`, `plainKeys`, `projectTree`, `readControls`, `readInstance`, `readProps`, `readRange`, `readSchema`, `readSlot`, `relatedDoc`, `renderStatus`, `repositoryPath`, `requireEqual`, `reservedAttributesInStartTag`, `resolveCatalogueEntry`, `resolveCatalogueSelection`, `resolveLinkPath`, `reviewInvalid`, `reviewMaterialKey`, `serializeBrowsingTarget`, `slotKey`, `sortedStrings`, `validateComponentSource`, `validateComponentViewRecord`, `validateComponentViews`, `validateControlledValues`, `validateControls`, and `validateResourcePath`. These have no public replacement.",
      "The entry also removes `CssPageEvidence`, `CssRuleAttribution`, `DependencyAnalysis`, `InsertedComponentStylesheet`, `PageResourceEvidence`, `ResourceEvidence`, `cssAnalysis`, and `mergeCssAnalysis`.",
    ],
    version: "0.16.0",
  },
] as const satisfies readonly Release[];
