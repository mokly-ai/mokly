# Co-Located Entry Discovery: Milestone 10 and Earlier Reviews

Historical appendix to the [owning plan](../co-located-entry-discovery.md).

### Milestone 10: Fourth review fixes

Apply the seven fourth-review findings. The first three remove the filesystem
calls that the basename and Review-output fixes introduced on hot paths, so
discovery and watching are no longer sensitive to descriptor or permission
conditions; the rest are doc, guard, and test hygiene.

- [x] Finding 1: make the watcher's prune predicate free of new I/O. Extend
      `WatchIgnorePredicate` in `src/server/watcher.ts` to receive chokidar's
      optional `stats` second argument and pass it through
      `ChokidarWatcherFactory`; in `src/server/watch_paths.ts`
      `isPackageOwnedIgnoredWatchPath`, derive "is a directory" from those
      stats when present, and when absent fail open (treat the leaf as a
      file) without calling `fs.statSync`. Keep `isDirectory` only where an
      event-time check is genuinely needed and make it fail open on every
      error rather than rethrowing. Add a test that a predicate call for a
      missing path and for a path whose stat throws `EMFILE` returns without
      throwing, and that a directory reported through `stats` named `dist`
      under a `src/**` glob is still pruned.
- [x] Finding 2: in `isPackageOwnedIgnoredWatchPath` and
      `isDiscoveryDeniedEntryPath`, scan the non-leaf segments first and
      consult the leaf's directory-ness only when the leaf name itself is a
      denied name, so the common case does no stat at all. Add a test that
      an `unlinkDir` style event for `src/dist` (path no longer exists) under
      `src/**` classifies as ignore, not rebuild, and that `src/dist/x.ts`
      is still ignored.
- [x] Finding 3: in `src/config/entry_discovery.ts`, resolve the projected
      real path of `review.outDir` once per `discoverEntryModules` call and
      compare each visited directory against it; wrap the per-directory
      real-path projection so a resolution or permission failure skips that
      directory instead of escaping `loadConfig`. Add a test using a
      directory with permissions removed (skip on Windows or when running as
      root) asserting `loadConfig` succeeds and simply does not search it.
- [x] Finding 4: in `docs/architecture/build-pipeline.md`, change "denied
      segment" to "denied directory" and add the `review.outDir`
      walk-pruning sentence for parity with the configuration contract.
- [x] Finding 5: reword the barrel guidance in
      `docs/protocol/mokly-configuration.md` and
      `docs/guides/authoring/config.md` to the actionable remedies: narrow
      the glob, rename the barrel so the glob no longer matches it, or stop
      re-exporting registry arrays. Do not claim exclusion syntax exists.
- [x] Finding 6: make the reporter a required `NotificationGate`
      constructor argument in `src/server/watch_events.ts`, update
      `src/server/resource_watcher.ts` to pass its existing failure reporter,
      and update every other construction site and test. Keep a test that a
      gate reports and continues; remove the "bare gate rethrows" case since
      a bare gate can no longer be constructed.
- [x] Finding 7: delete the constant-URL assertion in
      `tests/watch_boundaries.test.ts`; the restart wait already proves the
      server stays up.
- [x] Run `cargo xtask check` and commit locally; the supervising agent will
      push the branch.
- [x] Review the complete local diff against `origin/main` after the push
      using `docs/implementation-review-prompt.md`; report findings without
      changing the implementation. The post-push review of the Milestone 10
      commit reported seven findings, recorded under "Fifth Review Findings
      (awaiting decision)".

---

## Fourth Review Findings (approved, addressed in Milestone 10)

Review of the Milestone 9 commit. Nothing has been changed in response. All
seven are P2 or P3; the first three share one cause: the basename and
`review.outDir` fixes added filesystem calls to paths that previously did no
I/O.

1. **P2, a filesystem error in the watcher's prune predicate can abort
   startup.** The chokidar `ignored` predicate now calls `fs.statSync` and
   rethrows anything other than a path-resolution error. Chokidar turns that
   into an `error` event; during the initial walk that rejects watcher
   readiness and `mokly serve` refuses to start, and after readiness the
   subtree is silently left unwatched. Recommended: make the directory check
   fail open, and use the `stats` argument chokidar already passes to the
   predicate so the extra syscall disappears.
2. **P3, one extra stat per traversal candidate**, tens to low hundreds of
   milliseconds per full walk, and a just-deleted directory under a denied
   name now classifies as a rebuild. Recommended: scan the non-leaf segments
   first and stat only when the leaf itself carries a denied name.
3. **P3, `review.outDir` pruning resolves real paths for every visited
   directory** and a permission error now escapes `loadConfig` as a raw Node
   error where the old walk skipped it. Recommended: resolve the outDir once
   per discovery and treat a resolution failure on a candidate as a skip.
4. **P3, `docs/architecture/build-pipeline.md` still says "denied segment"**
   where the contracts now say directories only. Recommended: align the
   sentence and add the `review.outDir` pruning note.
5. **P3, the barrel guidance is unactionable**: `entries` rejects negated
   globs, so "exclude barrels from broad globs" cannot be expressed.
   Recommended: reword to narrow the glob, rename the barrel, or stop
   re-exporting registry arrays.
6. **P3, one `NotificationGate` in `resource_watcher.ts` still has no
   reporter.** Safe today because its consumer delegates to a guarded gate.
   Recommended: make the reporter a required constructor argument.
7. **P3, one weak assertion** in the new serve-level test checks a constant
   URL. Recommended: drop the line; the restart wait already proves the
   behaviour.

## Third Review Findings (approved, addressed in Milestone 9)

Review of the Milestone 8 commit. Milestone 9 addresses all six findings below.
The supervising agent confirmed findings 1, 2, and 4 by direct probe.

1. **P1, a watcher path error now crashes the dev server.** Finding 7 of the
   second round asked for the blanket catch in `isDiscoveryDeniedEntryPath`
   to be narrowed so only path-resolution failures fail closed. The narrowed
   catch rethrows other errors, but the classifier runs synchronously inside
   the chokidar event listener through `NotificationGate.notify`, which has
   no try/catch, and the repository installs no `uncaughtException` handler.
   An `EMFILE`, `EPERM`, or `EIO` from `projectRealPath` during watching now
   terminates `mokly serve`; `tests/watch_glob_boundaries.test.ts` locks the
   propagation in. Recommended: keep the narrowed catch but isolate every
   watcher event callback, routing the error to the existing reporter, and
   update the test to assert the reporter is called.
2. **P2, misleading zero-match error.** When a glob matches nothing, any
   denied directory skipped under its root wins over the zero-match message,
   so a typo such as `src/**/*.mokup.tsx` in a tree with an unrelated
   `src/node_modules` reports a private-directory problem. Recommended:
   report both causes in one message.
3. **P2, two protocol docs disagree** about glob-matched helpers:
   `mokly-source-protection.md` says a glob-selected helper requires a valid
   registry export and still lists only reserved basenames and public
   exclusions as ways to retain an unimported helper; `mokly-configuration.md`
   correctly says a matched helper without exports contributes nothing.
   Recommended: reword source protection to match and add glob match to its
   protection list.
4. **P3, a regular file named like a denied directory**, such as
   `src/target` under `src/**`, is accepted by the walk and then rejected by
   the per-module denial with a wrong message. Recommended: exclude the final
   path segment from the denial scan.
5. **P3, discovery and the watcher disagree about `review.outDir`.** The walk
   prunes denied names but not `review.outDir`, so a repository-root glob plus
   a custom outDir fails config loading after a Review run while the watcher
   ignores the same path. Recommended: prune `review.outDir` in the walk.
6. **P3, glob-only entries can double-register.** A matched barrel that
   re-exports a sibling's `mockups` registers the same definitions twice and
   fails with `duplicate-id`, undocumented and untested. Two test
   observations: one asserts a mock call count rather than behaviour, and one
   test name overstates what it proves. Recommended: document the rule, add a
   regression test, and tighten the two tests.

## Second Review Findings (approved, addressed in Milestone 8)

Review of the Milestone 7 fix commit. Nothing has been changed in response.

1. **P1, repository-root glob collapses ownership trust.** `isAuthoredOwner`
   trusts any owner beneath a glob's stable prefix; for `**/*.mockup.{ts,tsx}`
   that prefix is the repository root, so every in-repo owner path is
   trusted, a foreign Mokly-headered file under `mockupsDir` becomes a
   prunable orphan, and the unclaimed diagnostic never fires. Confirmed by
   direct probe. Recommended: trust a prefix owner only when it is named like
   an entry module and matches a configured glob, and treat an empty prefix
   as no prefix trust.
2. **P2, watcher prune and discovery disagree below a glob root.** The
   watcher prunes `dist`, `coverage`, `target`, `.context`, and temporary
   prefixes beneath a glob root, but discovery only skips `.git`,
   `node_modules`, and `.mokly-cache`, so `src/dist/x.mockup.tsx` builds but
   its creation is never seen while serving. Confirmed by direct probe.
   Recommended: one shared denied-segment policy used by both, with the
   watcher's list adopted by discovery.
3. **P2, watch and configuration docs over-state the prune contract** until
   findings 1 and 2 are fixed; then add the repository-root caveat.
4. **P2, a mainline sentence was deleted** from `mokly-watch.md`: "Package
   source under `node_modules` or an npx cache is never treated as consumer
   source." Recommended: restore it.
5. **P3, two em-dashes** were introduced in `mokly-watch.md`.
6. **P3, `unclaimedGeneratedRoutes` is not exception-safe**; a file removed
   between the walk and the read surfaces a raw ENOENT from `check`.
7. **P3, four private helpers in `watch_paths.ts` lack doc comments** and one
   blanket catch turns EACCES into "never rebuild" silently.
