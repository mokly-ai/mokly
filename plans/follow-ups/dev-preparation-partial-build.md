# npm run dev misses a partial build

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-30, from the branch `calummoore/npm-run-dev-automation`,
  review finding 1.
- **Location:** `scripts/dev-preparation.mjs:42`,
  `scripts/verification/prepared.mjs:5`,
  `packages/viewer/scripts/build.mjs:42`,
  `crates/mokly-server/src/assets.rs:45`,
  `crates/mokly-server/src/assets.rs:92`,
  `packages/mokly/scripts/build.mjs:44`, `xtask/src/artifacts.rs:44`.
- **Reason:** Only an interrupted `npm run build` causes the problem, and
  one `npm run build` recovers from it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Serve:** the `mokly serve` command. It needs the native binary, the
    viewer build in `packages/viewer/dist`, and the shim and the sidecar in
    `packages/mokly/dist`.
  - **Dev preparation:** the step of `npm run dev` in
    `scripts/dev-preparation.mjs` that runs `npm ci` and `npm run build`
    before Serve starts.
  - **Output list:** the files that `missingPreparedOutputs` in
    `scripts/verification/prepared.mjs` checks. `requirePrepared` and dev
    preparation share this list.
  - **Install record:** `node_modules/.package-lock.json`, which npm writes
    when an install completes.
- **Background:** `npm run dev` runs `scripts/dev.mjs`, which starts
  watched Serve on the example catalogue. Before Serve starts, dev
  preparation runs `npm ci` when the install record is missing or older
  than `package-lock.json`. It runs `npm run build` when a file of the
  output list is missing, or when the install record is newer than
  `packages/mokly/dist/sidecar.js`. `npm run build` builds the native
  binary, then `@mokly/ui`, `@mokly/viewer`, and `@mokly/mokly`. Each
  package build deletes its `dist` directory first. The paragraph about
  `npm run dev` in `docs/protocol/mokly-watch.md` states the requirement.
- **Problem:** The output list does not hold every file that Serve reads.
  Serve also reads `browser.manifest.json`, `shell.css`,
  `assets/brand.svg`, and `assets/fonts/InterVariable.woff2` in
  `packages/viewer/dist`. A viewer build that stops after
  `browser/inspector.js` but before `shell.css` leaves every listed file in
  place. Dev preparation then runs no build. Serve stops with "Build or
  reinstall the matching @mokly/viewer package and retry." Two cases of
  the same class exist. A mokly build that stops after the `shim.mjs` copy
  leaves `dist/runtime.mjs` missing, and the CLI import fails. An
  interrupted copy of the native binary can leave a truncated file, which
  the presence check accepts.
- **Impact if no action:** After an interrupted `npm run build`,
  `npm run dev` can start Serve on an incomplete build, and Serve fails.
  The developer must run `npm run build` by hand.
- **Root question:** How does `npm run dev` know that the build is
  complete before it starts Serve?
- **Options:**
  - **A.** Add `shell.css`, `browser.manifest.json`, `assets/brand.svg`,
    and `assets/fonts/InterVariable.woff2` of `packages/viewer/dist` to the
    output list. Add a test case where only `shell.css` is missing. The
    list needs an update each time Serve reads a new file. Effort: Small.
  - **B.** Write a complete inventory of the runtime files in each package
    build, and check the inventories in dev preparation. Several package
    builds change. Effort: Large.
  - **C.** Add a readiness command to the binary that reports missing
    generated files, and build from its result. This adds a command
    interface. Effort: Large.
  - **D.** Do A. Also move the `browser.manifest.json` write to the end of
    `packages/viewer/scripts/build.mjs`, after `shell.css` and
    `styles.css`. The manifest then exists only after a complete viewer
    build, so a partial viewer build always fails the check. The binary
    already finds a viewer `dist` by this file. `requirePrepared` then
    names the added files too, but it rejects only builds that Serve
    cannot use. D does not cover the mokly and native cases. Effort: Small.
  - **E.** Record each complete root build. `npm run build` deletes a
    record file first and writes it after its last step. Dev preparation
    builds when the record is missing or older than the install record.
    The record replaces the `sidecar.js` comparison, and the output list
    stays for deleted files. E covers a partial or failed build of every
    stage, also the mokly and native cases. A workspace build alone does
    not touch the record. E changes the build rule of the `npm run dev`
    requirement. Effort: Medium.
  - **F.** Make the viewer build all-or-nothing. TypeScript and the bundles
    write to a staging directory, which the build renames to `dist` at the
    end. F covers the viewer only. Effort: Medium.
  - **G.** Run a cache-aware build on every `npm run dev`, which skips each
    step whose inputs did not change. It needs a new dependency or a
    fingerprint in every package build. The native step still fails with
    "Text file busy" when the binary changed while another Serve runs it.
    Effort: Large.
- **Left out:** A complete build on every start, because the decision in
  `docs/protocol/mokly-watch.md` rejects it: every start waits for a
  complete build, and the build cannot replace the binary that another
  Serve runs. A rebuild and a restart after Serve fails, because C is
  better on every point. A change to the docs only, because it fails the
  goal.
- **Wider fix:** B, which is Large. E covers every stage of the root
  build at Medium effort.
- **Previous examples:** None found.
- **Recommendation:** D. It is a Small structural fix of the viewer case.
  E best protects the codebase, because it covers every stage, but it
  changes the requirement and needs the user's decision.
- **Action:** fix after merge, apply D, because only an interrupted build
  causes the problem, and one `npm run build` recovers from it.
