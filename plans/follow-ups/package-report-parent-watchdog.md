# Require the sidecar parent watchdog in package reports

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of the 117 C port review.
- **Location:** `scripts/release/package_reports.mjs:34`,
  `packages/mokly/src/sidecar/parent-input.ts:12`, and
  `tests/release_native.test.ts:94`.
- **Reason:** The PostCSS loader-path port review found this gap in release
  code outside its change, so a separate branch fixes it.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Package report:** the file list of `npm pack --dry-run` for one
    package, which `scripts/release/package_reports.mjs` checks before a
    release.
  - **Parent watchdog:** the worker thread in
    `packages/mokly/src/sidecar/parent-watchdog.ts` that owns the sidecar's
    standard input, so that end of input or parent death stops a render.
- **Background:** `validateCliReport` lists the files that the
  `@mokly/mokly` package must contain, such as `dist/sidecar.js`,
  `dist/sidecar/postcss-worker.js`, and the PostCSS preload. A package that
  lacks one fails the release. `tests/release_native.test.ts` removes each
  listed file in turn and expects the check to fail. TypeScript emits
  `dist/sidecar/parent-watchdog.js`, and `parent-input.ts` starts it with
  `new Worker(new URL("./parent-watchdog.js", import.meta.url))`.
- **Problem:** The required list does not name
  `dist/sidecar/parent-watchdog.js`. A package without that file passes the
  release check.
- **Impact if no action:** A build or packing change can drop the
  watchdog, and the release then publishes a CLI whose sidecar input fails
  at every start.
- **Root question:** How should the release prove that the CLI package
  holds every sidecar file that the code loads by path?
- **Options:**
  - **A.** Add `dist/sidecar/parent-watchdog.js` to the required list of
    `validateCliReport`, and add it to the missing-file cases of
    `tests/release_native.test.ts`. This adds a release rejection.
    Effort: Small.
  - **B.** Start the watchdog from inline source, so that no separate file
    exists. This changes the sidecar start and the read-evidence filter of
    `postcss-read-sharing.ts`, which names the watchdog file. Effort: Medium.
  - **C.** Keep one shared list of the separately loaded sidecar files,
    which the build and the release check both read. This adds a release
    rejection. Effort: Large.
- **Left out:** A check of the built tree alone misses a file that packing
  leaves out, so it fails the goal.
- **Wider fix:** C. One shared list covers every file that the sidecar
  loads by path, not only the watchdog.
- **Previous examples:** A review of the same port found that the release
  check did not require `dist/sidecar/postcss-async-loader.mjs`, which the
  PostCSS preload loaded by path. The user closed it with no work on
  2026-10-26, because a later change removed that bundle.
- **Recommendation:** A. It closes the known gap with the
  smallest change. C best protects the codebase.
- **Action:** ask the user, because A and C add a release rejection, and B
  changes product startup code for a test gap.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6741).
