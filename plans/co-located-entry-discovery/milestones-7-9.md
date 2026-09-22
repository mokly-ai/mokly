# Co-Located Entry Discovery: Milestones 7 through 9

Historical appendix to the [owning plan](../co-located-entry-discovery.md).

### Milestone 7: Review fixes

Apply the approved review decisions, add failing-first coverage for every
behavioral defect, and leave the branch locally committed for the supervising
agent to verify and push.

- [x] Fix Finding 1 by pruning ignored descendants beneath entry-glob roots
      while retaining the ancestor path needed to reach each root, and align
      entry-glob event classification with discovery.
- [x] Fix Finding 2 by trusting ownership headers beneath stable entry-glob
      prefixes, keeping registry attribution strict, and reporting unclaimed
      generated HTML during committed checks.
- [x] Fix Finding 3 by making the primary README and authoring-guide examples
      use one entry glob while documenting the multi-glob form in prose.
- [x] Fix Finding 4 by validating `review.outDir` again after entry discovery.
- [x] Record Finding 5 as already fixed without changing its implementation.
- [x] Fix Finding 6 with serve rediscovery, symlinked `entriesDir`, missing
      stable-prefix, POSIX normalization, direct cache-denial, and reachable
      glob-expansion coverage, removing dead branches where appropriate.
- [x] Fix Finding 7 by extracting watch-path classification from
      `watch_events.ts` and updating its consumers and documentation.
- [x] Run `npm run build`, the required affected test files, and
      `cargo xtask check` in that order.
- [x] Stage all files and commit locally with a Conventional Commits message;
      the supervising agent will verify and push without changing branches.
- [x] After the supervising agent pushes, review the complete diff against
      `origin/main` with `docs/implementation-review-prompt.md` and report
      findings without changing the implementation. The post-push review of
      the fix commit reported seven further findings, recorded under
      "Second Review Findings (awaiting decision)".

## Review Findings (addressed)

The review of the complete diff against `origin/main` reported these findings.
The approved option applied to each finding is recorded below.

1. **P1, watcher prune.** `isRequiredWatchPath` in `src/server/watch_events.ts`
   treats every entry glob's stable prefix as a required root, and required
   roots override the package-owned ignore list. With `src/**` the watcher
   traverses `src/node_modules` and `src/dist`; with a repository-root glob it
   traverses `node_modules` and `.git`. Recommended: apply the ignore list
   before the required-root override for glob roots, with a regression test.
   **Applied option:** glob roots now protect only their ancestor traversal;
   descendants apply ignored-path rules relative to the deepest containing
   glob root, and entry-shaped events in discovery-denied trees stay ignored.
2. **P2, stranded output.** `isAuthoredOwner` trusts owners beneath a directory
   that currently holds an entry module. Deleting the only entry module in a
   co-located directory leaves its generated HTML unowned, so it is neither
   pruned nor replaceable, and `check` does not report it. The configuration
   contract's "never strands" sentence over-promises. Recommended: also trust
   an entry-module-named owner under any glob's stable prefix, and report
   unowned Mokly-headered files as a distinct `check` diagnostic.
   **Applied option:** ownership headers and tracked output trust stable glob
   prefixes, registry attribution remains restricted to resolved or inventoried
   sources, and committed Check reports unclaimed generated HTML separately.
3. **P2, doc examples.** The README and config guide show two globs; a fresh
   repository with only one location fails with the zero-match error.
   Recommended: single-glob examples with the multi-glob form in prose.
   **Applied option:** both primary examples use one glob and explain that each
   item in a multi-glob configuration must match an entry module.
4. **P2, review.outDir.** In `entries` mode, config resolution validates
   `review.outDir` before discovery, so an output directory inside an entry
   root is only rejected later by Review or Export. Recommended: re-run the
   boundary check after discovery in `validate.ts`.
   **Applied option:** config resolution repeats `validateReviewOut` with the
   discovered `entryModules` before returning the resolved config.
5. **P3, plan scope.** This plan's scope says a match inside `mockupsDir` is
   rejected; the delivered contract allows nested `docs/mockups/src` layouts.
   Corrected below.
   **Applied option:** no new change; the scope correction was already present
   before this milestone and remains intact.
6. **P3, coverage.** No serve-level re-discovery test; no tests for a
   symlinked `entriesDir`, a missing stable prefix, or brace-expansion errors;
   two unreachable branches in `entry_globs.ts` and `entry_discovery.ts`.
   **Applied option:** coverage now exercises every named boundary. Minimatch's
   `braceExpand` throws for string patterns longer than 65,536 characters, so
   the translation catch remains and is covered. The post-normalization
   backslash check was removed, while the direct-discovery cache denial remains
   as documented defense in depth and is reached directly.
7. **P3, file size.** `src/server/watch_events.ts` is 311 lines.
   **Applied option:** path and glob helpers moved to `watch_paths.ts`, the old
   `watch_entry_globs.ts` was folded into it, and both modules are below 300
   lines.

---

### Milestone 8: Second review fixes and glob-only entry shape

Apply the seven second-review findings and remove the fixed filename suffix
so that a configured `entries` glob alone decides what an entry module is.
Ownership trust is then "the recorded source matches a configured entry
glob", a single rule that reads the same way the glob does.

- [x] Remove the `.mockup.ts`/`.mockup.tsx` suffix filter from discovery
      (`src/config/entry_discovery.ts`), the watcher's entry-candidate check
      (`src/server/watch_paths.ts`), and any other site; delete
      `ENTRY_MODULE_SUFFIXES` and `isEntryModuleName` when unused. The
      `entriesDir` shorthand keeps expanding to `<dir>/**/*.mockup.{ts,tsx}`.
      Reword the zero-match error to "entries glob matches no module".
- [x] Finding 1: replace stable-prefix ownership trust with "the recorded
      source path matches a configured entry glob" (minimatch, `dot: true`,
      against the repository-relative path), keeping resolved-entry and
      inventoried-source trust. An empty stable prefix confers no trust by
      itself. Add tests: under `**/*.mockup.{ts,tsx}` a foreign owner
      `other/catalogue/thing.mockup.tsx` IS trusted (it matches the glob)
      but `docs/notes.md` is NOT; under `src/**/*.mockup.{ts,tsx}` neither
      is; a deleted or renamed entry module that still matches its glob
      remains trusted so its old output is cleaned up; the unclaimed
      diagnostic fires for `docs/notes.md`-style owners under a root glob.
- [x] Finding 2: introduce one shared denied-segment policy in
      `src/config/` used by discovery's directory walk, discovery's
      per-module denial, and the watcher's prune and entry-candidate checks,
      seeded with the watcher's current list (`.git`, `node_modules`,
      `.mokly-cache`, `dist`, `coverage`, `target`, `test-results`,
      `playwright-report`, `.context`, and the `.mokly-review-`/
      `.mokly-write-` prefixes). Discovery must refuse a module beneath any
      of those segments relative to the deepest containing glob root, so
      `src/dist/x.mockup.tsx` under `src/**` is neither built nor watched,
      while an explicit `dist/entries/**` root still works. Add a test that
      discovery and the watcher agree for `src/dist/x.mockup.tsx`.
- [x] Finding 3: correct `docs/protocol/mokly-watch.md` and
      `docs/protocol/mokly-configuration.md` so the prune and trust rules
      state exactly the behavior after findings 1 and 2.
- [x] Finding 4: restore the deleted sentence "Package source under
      `node_modules` or an npx cache is never treated as consumer source." to
      `docs/protocol/mokly-watch.md`.
- [x] Finding 5: replace the two em-dashes in `docs/protocol/mokly-watch.md`
      with commas or separate sentences.
- [x] Finding 6: make `readGeneratedSource` in `src/build/ownership.ts`
      return `undefined` when the file cannot be read, so
      `unclaimedGeneratedRoutes` and `generatedOwnershipDenial` never
      surface a raw filesystem error.
- [x] Finding 7: add doc comments to `isGeneratedOutputPath`,
      `isRequiredWatchPath`, `deepestContainingRoot`, and the
      discovery-denied helper in `src/server/watch_paths.ts`; narrow the
      blanket catch so only path-resolution failures fail closed, with the
      fail-closed choice documented.
- [x] Update every doc and README that states the suffix rule: the
      configuration contract, authoring, source protection, watch, package,
      build pipeline, the start and authoring guides, README, and the build
      and components READMEs. State that the glob defines the entry shape and
      that `entriesDir` is shorthand for the suffixed glob.
- [x] Update `tests/entry_discovery.test.ts` (the "glob matching only
      helpers counts as zero matches" case becomes "a glob matches whatever
      it names") and any test that relied on the suffix filter.
- [x] Run `cargo xtask check` and commit locally; the supervising agent will
      push the branch.
- [x] Review the complete local diff against `origin/main` after the push
      using `docs/implementation-review-prompt.md`; report findings without
      changing the implementation. The post-push review of the Milestone 8
      commit reported six findings, recorded under "Third Review Findings
      (awaiting decision)".

---

### Milestone 9: Third review fixes

Apply the six third-review findings. The first isolates watcher event
handling so a filesystem error can never terminate `mokly serve`; the rest
correct diagnostics, docs, and two discovery edge cases, and document and test
the double-registration risk of broad globs.

- [x] Finding 1: isolate every watcher event callback. In
      `src/server/watch_events.ts`, make `NotificationGate.notify` and
      `open` deliver through a guarded call that routes a thrown error to a
      reporter supplied at construction, so a classifier error is reported
      once and the event dropped. Thread the existing `report` callback from
      `serve_watched.ts` into the gates it creates. Keep the narrowed catch in
      `isDiscoveryDeniedEntryPath`. Update the test in
      `tests/watch_glob_boundaries.test.ts` that asserts an `EIO` propagates
      from `classifyWatchPath` so it instead asserts, through a gate with a
      recording reporter, that the error is reported and the server keeps
      accepting later notifications. Add a serve-level test that injects a
      throwing classifier path during `serve` with `watch: true` and asserts
      the server stays up and the reporter received the error.
- [x] Finding 2: when a glob matches nothing, report both causes in one
      `config-invalid` message: the zero-match text followed by the denied
      trees that were not searched, if any. Update the tests that assert
      either message.
- [x] Finding 3: in `docs/protocol/mokly-source-protection.md`, state that a
      glob-matched file is an entry module and therefore protected source,
      that one exporting no registry value contributes nothing (matching the
      configuration contract), and add "matched by an `entries` glob" to the
      list of ways a retained unimported helper stays protected.
- [x] Finding 4: in `src/config/entry_discovery.ts`, exclude the final path
      segment from the per-module denied-segment scan so a regular file named
      like a denied directory, such as `src/target`, is accepted exactly as
      the walk accepts it. Mirror the same rule in the watcher's
      `isDiscoveryDeniedEntryPath`. Add a test for `src/target` under
      `src/**` in both discovery and the watcher.
- [x] Finding 5: prune `review.outDir` in discovery's directory walk so a
      broad glob skips it silently, exactly as the watcher does; keep the
      hard per-module error only when a glob's stable prefix lies inside
      `review.outDir`. Add a test: `entries: ["**/*.mockup.{ts,tsx}"]` with
      `review: { outDir: ".review" }` and a matching file under `.review`
      loads successfully and does not discover that file.
- [x] Finding 6: document in `docs/protocol/mokly-configuration.md` that a
      glob-matched module re-exporting another matched module's `mockups`
      registers those definitions twice and fails with `duplicate-id`, and
      add a regression test that a barrel under `src/**/*.ts` produces that
      error. Replace the mock-call-count assertion in
      `tests/build_check_unclaimed.test.ts` with a behavioural one, and rename
      the misnamed test in `tests/watch_glob_boundaries.test.ts` to say what
      it proves.
- [x] Run `cargo xtask check` and commit locally; the supervising agent will
      push the branch.
- [x] Review the complete local diff against `origin/main` after the push
      using `docs/implementation-review-prompt.md`; report findings without
      changing the implementation. The post-push review of the Milestone 9
      commit confirmed the extracted `WatchedBackground` and
      `reportedWatchProcessor` modules are behaviourally identical to the
      inline code they replaced, and reported seven findings, recorded under
      "Fourth Review Findings (awaiting decision)".

---
