# Stylesheet keys hold earlier JavaScript lookups

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: a new problem that the
  finding check of finding 138 found.
- **Location:** `packages/mokly/src/sidecar/vite-resolution.ts:43`,
  `packages/mokly/src/sidecar/resolution-inputs.ts:74`,
  `crates/mokly-css/src/vite.rs:126`, and
  `crates/mokly-graph/src/stylesheet_keys.rs:31`.
- **Reason:** The fix changes the lookup record that the JavaScript and the
  stylesheet requests share, and it must land with or after the fix of
  `plans/follow-ups/installed-module-watch-paths.md`.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript and
    transforms stylesheets through the project's own Vite setup.
  - **Lookup record:** The files and directories that module resolution
    probed for a request, such as package manifests. The sidecar reports
    them as metadata inputs.
  - **Stylesheet key:** The identity of a Vite stylesheet result. The core
    reuses a stylesheet while its key stays equal.
- **Background:**
  - Each Vite setup keeps one `ViteLookup` for its requests.
    `ViteLookup.updatePaths` copies every earlier lookup file and directory
    of the setup into the paths of each later request, at
    `packages/mokly/src/sidecar/vite-resolution.ts:43`.
  - The metadata of a request lists each lookup file, at
    `packages/mokly/src/sidecar/resolution-inputs.ts:74`. On the stylesheet
    path, each present metadata input becomes read evidence, at
    `crates/mokly-css/src/vite.rs:126`, and the read evidence enters the
    stylesheet key, at `crates/mokly-graph/src/stylesheet_keys.rs:31`.
  - `docs/protocol/mokly-watch.md:61` says that a key moves when one of its
    inputs changes, and only then.
  - The copy can be a deliberate cover for Vite's package cache. A later
    request can reuse a package that an earlier request resolved, without a
    new probe of its manifest.
  - Today the copy also gives Serve a watch of the manifest of an installed
    JavaScript package at its real path, through the stylesheet watch
    mapping. The first manual run of a Serve test on 2026-11-25 rebuilt for
    `installed/node_modules/fixture-native/package.json` in this way.
    `plans/follow-ups/installed-module-watch-paths.md` records that the
    JavaScript watch inputs of installed modules lack such a mapping.
- **Problem:** A Vite stylesheet result reports the lookups of earlier
  JavaScript requests, such as
  `node_modules/.mokly-roots/1/fixture-native/package.json`. So an edit of a
  manifest that only JavaScript uses moves the stylesheet key, and the key
  depends on the requests that the worker served before.
- **Impact if no action:** Serve and comparisons transform stylesheets again
  after edits that cannot change them. Two workers can give different keys
  for equal inputs, so reuse misses.
- **Root question:** How does each Vite request report the lookups that its
  own resolutions depend on, also when Vite's package cache serves a package
  that an earlier request resolved?
- **Options:**
  - **A.** Keep a lookup record for each resolved package directory. Each
    request adds the record of each package that it resolves, also when
    Vite's package cache serves the package. Stop the copy in `updatePaths`.
    Test that a stylesheet key ignores an edit of a manifest that only
    JavaScript reads, and that it moves for a manifest that the stylesheet's
    own resolution reads. Effort: Medium.
  - **B.** Keep the copy for JavaScript requests. Give each stylesheet
    request only the lookups of its own transform and of the packages that
    its imports resolve. Cost: the JavaScript keys still depend on the
    earlier requests of the worker. Effort: Medium.
  - **C.** Clear Vite's package cache before each request, so that each
    request probes again and records its own lookups. Cost: each request
    reads every manifest again. Effort: Small.
- **Left out:** Keep the copy, and state it as an over-approximation. It
  breaks the rule of `docs/protocol/mokly-watch.md:61` that a key moves only
  when its own inputs change.
- **Wider fix:** A. A lookup record that belongs to the package, not to the
  request, gives each request the same lookups for the same resolutions,
  whatever the worker served before.
- **Previous examples:** None found.
- **Related:**
  - `plans/follow-ups/installed-module-watch-paths.md`: work that depends on
    the order. The copy gives Serve a watch of the manifest of an installed
    JavaScript package today. A removes that watch, so land A with or after
    the JavaScript watch mapping of that item.
  - `plans/follow-ups/vite-base-workspace-export.md`: same code. Its fix
    records each `package.json` that it reads as a lookup input. When A lands
    first, that fix adds those files to the lookup record of the package.
  - `plans/follow-ups/workspace-import-resolution-record.md`: same code. The
    lookup record of A is reuse evidence, which that shared import record can
    hold.
  - `plans/follow-ups/vite-config-request-kind.md`: same code. Its option A
    keeps the module paths of the Vite config apart from the swap in
    `ViteLookup.updatePaths`. A here removes the copy of lookups in that
    function, so the lookups of the config must then stay with the setup.
- **Recommendation:** A. It keeps the cover for Vite's package cache, and it
  makes each key depend only on its own resolutions.
- **Action:** fix after merge, apply A, because the cost is extra transforms,
  not wrong output, and the fix must follow the JavaScript watch mapping of
  `plans/follow-ups/installed-module-watch-paths.md`.
