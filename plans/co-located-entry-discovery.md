# Co-Located Entry Discovery

## Status And Outcome

Status: completed for PR #101's delivered scope on 2026-09-22, at the user's
request. Unfinished review and post-merge work is owned by
[Co-Located Entry Discovery Follow-up](./co-located-entry-discovery-follow-up.md)
for a separate PR; none of it is implemented by this close-out. The historical
milestones and review records remain here. PR #101's merge is the delivery
boundary.

Milestones 1 through 13 are complete, committed, and pushed. Milestone 11
preserves watcher event kinds and stats through classification and reports
discovery failures except benign missing-directory races; its gate passed with
1,976 unit tests, five packed-consumer scenarios, and 466 Chrome tests after the
supervising agent replaced the permission test's root-only skip with a runtime
probe, since capability-holding processes read mode-000 directories. Milestone
12 applied four approved sixth-round findings; findings 5 and 6 are accepted as
documented behavior. The post-push review of Milestone 12 reported eight
findings, recorded below. The user approved fixing findings 1 and 2; Milestone 13
delivered them and its post-push review reported two P3 items. Seventh-round
findings 3 through 8 and both eighth-round items are transferred to the
follow-up, including the eighth-round residual note. Their original
observations remain below. The follow-up also owns the latest post-CI review's
conflicting entry-layout documentation finding.

The final local `cargo xtask check` passed with 2,233 unit/integration tests
and 686 browser tests, with no failures, skips or cancellations. The
[post-fix CI run](https://github.com/mokly-ai/mokly/actions/runs/35724564158)
and [preview run](https://github.com/mokly-ai/mokly/actions/runs/35724564195)
passed. This close-out changes planning and delivery-status documentation only.

Mokly currently discovers every `*.mockup.ts` and `*.mockup.tsx` module below
one configured directory, `entriesDir`, and binds the source-attributed
authoring facade only to modules imported from beneath that directory. Five
separate rules depend on that single directory: discovery, facade binding,
entry source attribution, generated-file ownership proof, and the watched
development rebuild classification. Only discovery needs a location at all, and
none of them needs a single location.

This plan replaces the directory with a list of repository-relative POSIX globs
so entry modules can live beside the product components they describe, the way
Storybook stories do. It binds the authoring facade to every repository-owned
module, so a helper next to a component can call `defineComponent` and still be
attributed to its real file. It replaces the directory-membership rules with
membership in the resolved entry set and the existing manifest `sourceFiles`
inventory, which already records every bundler input wherever it lives.

Two guarantees do not change. Every entry keeps a stable, safe,
repository-relative source path that owns its generated documents and its Git
baseline. Authoring sources are never published, and inputs outside `repoRoot`
are rejected. What changes is where those guarantees are checked: per resolved
entry module instead of per configured directory.

The follow-up idea of installable component-library adapters, adopted from
`node_modules` through an explicit adoption helper, is out of scope here. It
depends on the facade relaxation delivered by this plan and gets its own
protocol document and plan afterwards.
The [follow-up plan](./co-located-entry-discovery-follow-up.md) now owns that
planning task and the published-consumer smoke test.

Related contracts:

- [Configuration contract](../docs/protocol/mokly-configuration.md)
- [Public authoring API](../docs/protocol/mokly-authoring.md)
- [Catalogue source protection](../docs/protocol/mokly-source-protection.md)
- [Watched development](../docs/protocol/mokly-watch.md)
- [Export](../docs/protocol/mokly-export.md)
- [Build pipeline](../docs/architecture/build-pipeline.md)

## Scope

In scope:

- A new `entries` config field holding ordered repository-relative POSIX globs,
  with `entriesDir` retained as validated sugar for one glob and rejected when
  both are supplied.
- Glob discovery that resolves every match, applies the existing source
  classifier to each match, and fails on a pattern with zero matches or a match
  inside `review.outDir`, `.mokly-cache/`, `node_modules`, `.git`, or outside
  `repoRoot` after realpath resolution. A match below `mockupsDir` is allowed
  and protected as authored source, preserving nested `docs/mockups/src`
  layouts.
- Facade binding for every module inside `repoRoot` that is not under
  `node_modules`, a package runtime directory, or `.mokly-cache/`.
- Entry attribution, generated ownership, tracked ownership, and watch
  classification rules that accept any resolved entry module or inventoried
  source file instead of testing `entriesDir` containment.
- Source-denial messages and public-name policy that name the resolved entry
  set rather than a directory.
- Moving the basic example's registered Action and Toolbar components beside
  a co-located product-style component directory to prove the layout.
- Protocol, guide, README, and changelog updates.

Out of scope, tracked as follow-up plans:

- Adoption of component definitions shipped in installed packages.
- A generator that drafts adapters from a library's type declarations.
- Any change to the manifest schema. `sourcePath`, `sourceFiles`, and
  `declaredDependencies` keep their v5 shape and meaning.

## Global Constraints

- Run `cargo xtask check` before declaring any code milestone complete. The
  documentation milestone validates Markdown with `npm run format:check` and a
  diff review instead.
- After checks pass at each milestone end: `git add -A`, commit with a
  Conventional Commits title of at most 50 characters, and push.
- Never hand-edit `examples/basic/generated/**` HTML or the manifest; run
  `npm run example:build` and commit only the tracked authored CSS. Generated
  HTML and the manifest are ignored under the default derived mode.
- Protocol docs under `docs/protocol/` change in the same milestone as the
  behavior they describe, except that Milestone 1 defines the complete target
  contract up front.
- Decisions locked by this plan, flag before implementing if the user objects:
  - `entries` globs are matched against repository-relative POSIX paths,
    relative to `repoRoot`, not the config directory, so they read the same
    way as `review.sharedImpact` and `watch.rules` globs.
  - A glob that matches zero files is a config error, not an empty catalogue.
  - Revised in Milestone 8: an entry module is exactly a file matched by a
    configured `entries` glob. Mokly applies no fixed filename suffix on top
    of the glob; the glob alone defines the entry shape, as Storybook's story
    patterns do. The `entriesDir` shorthand still expands to
    `<dir>/**/*.mockup.{ts,tsx}`, so existing consumers keep their current
    behavior. The original decision imposed a `.mockup.ts`/`.mockup.tsx`
    suffix even when a glob matched other names; that restriction was
    redundant with the glob and was removed.
  - Resolved entry modules are sorted by repository-relative path, so
    discovery order does not depend on glob order or filesystem order.
  - The attributed facade binds to every repository-owned module. A definition
    created in a helper file is attributed to that helper file, not to the entry
    module that imports it. This matches the existing "attributed at the helper
    call itself" rule and extends it beyond `entriesDir`.
  - `entriesDir` stays supported as `entries: ["<dir>/**/*.mockup.{ts,tsx}"]`
    with the same validation it has today, so existing consumers and the
    published guides keep working unchanged. Supplying both fields is an error.

## Milestones

---

Milestones 1 through 10 and earlier review findings are retained in linked
historical appendices to keep each file under 300 lines:

- [Milestones 1 through 6](./co-located-entry-discovery/milestones-1-6.md)
- [Milestones 7 through 9 and first review](./co-located-entry-discovery/milestones-7-9.md)
- [Milestone 10 and second through fourth reviews](./co-located-entry-discovery/milestone-10-and-reviews.md)

### Milestone 11: Event-aware classification and loud discovery

Apply the seven fifth-review findings. Findings 1 and 2 and the missing-path
heuristic share one cause: the chokidar adapter discards the event kind and
stats that chokidar already supplies, so classification guesses directory
status from the filesystem. Threading that information through removes the
guessing. Finding 3 restores loud discovery failures.

- [x] Change `ConsumerWatcher.onChange` in `src/server/watcher.ts` to deliver
      `{ path, kind, stats? }` where `kind` is chokidar's event name (`add`,
      `addDir`, `change`, `unlink`, `unlinkDir`) or `raw` for the rename
      fallback; carry it through `ResourceWatchNotifications` and every
      `NotificationGate` and test double that forwards paths.
- [x] Make `classifyWatchPath` consume `WatchEvent` and give
      `isPackageOwnedIgnoredWatchPath` an optional directory hint. Status comes from `stats` when
      present, else from the event kind (`addDir`/`unlinkDir` are
      directories, `add`/`change`/`unlink` are files), and only when neither
      is known from an event-time `fs.statSync` that fails open. Delete
      `isMissing` and the lazily evaluated missing-path heuristic in
      `isDiscoveryDeniedEntryPath`. Findings 1 and 2 follow: an existing or
      removed denied-name directory outranks user watch rules again, and a
      removed matched file named like a denied directory rebuilds.
- [x] Finding 3: in `src/config/entry_discovery.ts`, swallow only `ENOENT`
      and `ENOTDIR` in `readEntryDirectory` and the Review-output skip;
      surface any other read or projection error as `config-invalid` naming
      the directory; record concurrently vanished directories as skipped and
      list them with the denied roots in the zero-match message. Delete the
      `0o555` mode mask (finding 5). Guard the top-level `review.outDir`
      projection with a lexical fallback and hoist the per-module
      `realpathSync(repoRoot)` and glob-root projections into the
      once-per-pass paths object (finding 6).
- [x] Finding 4: scope the "no filesystem lookup" sentence in
      `docs/protocol/mokly-watch.md` to the denied-leaf directory check and
      rename the test accordingly; extend the descriptor-exhaustion test to
      mock `lstatSync`, `readFileSync`, and `openSync` as well as `statSync`
      and assert the traversal predicate still returns without throwing.
- [x] Finding 7: add a test that deleting a matched module with an ordinary
      name still classifies as rebuild, and a test that the resource
      watcher's gate reports a thrown non-`Error` value through `failed` as
      an `Error`.
- [x] Update `docs/protocol/mokly-watch.md`, `docs/protocol/mokly-configuration.md`,
      `docs/architecture/build-pipeline.md`, `src/build/README.md`, and
      `src/server/README.md` so they state the event-aware rule and the
      loud-failure rule exactly.
- [x] Run `cargo xtask check`, commit, and push.
- [x] Review the complete local diff against `origin/main` after the push
      using `docs/implementation-review-prompt.md`; report findings without
      changing the implementation. The post-push review found no regressions
      and confirmed the event-aware design closed the earlier ones; its seven
      findings are recorded under "Sixth Review Findings (awaiting decision)".

---

### Milestone 12: Sixth review fixes

Apply approved fixes for vanished modules, fail-open watch traversal, and test
hygiene. Findings 5 and 6 remain accepted without change.

- [x] Finding 1: in `src/config/entry_discovery.ts` `entryModuleDenial`,
      when `projectRealPath(module)` fails with `ENOENT`, drop the module
      from the resolved set instead of throwing, using the shared
      `isVanishedDirectory` policy; keep `ENOTDIR` and every other code
      loud. When dropping the last match of a glob leaves that glob with
      zero modules, report the normal zero-match error with the vanished
      module listed under `not searched`. Add a test that removes a matched
      module between the walk and the denial loop (mock `fs.realpathSync`
      or `projectRealPath` to throw `ENOENT` for that one path) and asserts
      `loadConfig` succeeds with the module absent, plus a test that
      `ENOTDIR` still fails with `config-invalid`.
- [x] Finding 2: in `tests/watch_glob_boundaries.test.ts`, replace the bare
      `assert.doesNotThrow` in the descriptor-exhaustion test with
      `assert.equal(..., false)` so the fail-open value is pinned, and mock
      `fs.lstatSync`, `fs.readFileSync`, and `fs.openSync` to throw `EMFILE`
      alongside `fs.statSync` so the traversal predicate is proven safe
      through the export-marker and ownership-header reads too.
- [x] Finding 3: in `tests/helpers/watch_config.ts`, delete the duplicated
      doc comment above `FakeWatcherFactory` and `FakeSupervisorFactory`
      and give each factory its own one-line description.
- [x] Finding 4: delete the source-text regex test in
      `tests/entry_discovery_edges.test.ts` that reads the discovery module
      as a string; the permission-probe test already proves the behavior.
- [x] Replace the non-null assertion `roots.get(root)!` in
      `src/config/entry_discovery_paths.ts` with a local variable, and
      reflow the overlong line in `src/build/README.md`.
- [x] Run `cargo xtask check`, commit, and push.
- [x] Review the complete local diff against `origin/main` after the push
      using `docs/implementation-review-prompt.md`; report findings without
      changing the implementation. The post-push review reported eight
      findings, recorded under "Seventh Review Findings (awaiting decision)".

---

### Milestone 13: Deleted-module race and directory error contract

Apply seventh-review findings 1 and 2. A matched module that is deleted after
the directory listing but before validation is dropped from the resolved set,
which the previous fix promised but only delivered for the narrow window
inside real-path projection. The configuration contract regains the directory
read and projection error rule it lost.

- [x] Finding 1: in `src/config/entry_discovery.ts`, before validating a
      matched candidate, confirm it still exists as a regular file with
      `fs.lstatSync`; treat `ENOENT` as vanished (drop it, record it under
      `not searched`) through the shared `isVanishedModule` policy, treat
      `ENOTDIR` and every other code as `config-invalid` naming the path and
      code, and treat a candidate that now exists but is no longer a regular
      file as vanished as well, since the walk only ever listed regular
      files. Keep the existing projection-failure handling. Add a test in
      `tests/entry_discovery_errors.test.ts` that really deletes a matched
      module between the directory listing and validation (wrap
      `fs.readdirSync` to remove the file after listing, no mocking of
      `realpathSync`) and asserts the module is absent and the others
      present; a variant deleting a glob's only match asserts the zero-match
      message lists it under `not searched`; and a variant replacing the
      file with a directory of the same name asserts it is dropped rather
      than resolved.
- [x] Finding 1 docs: narrow or correct the vanished-module sentence in
      `docs/protocol/mokly-configuration.md`,
      `docs/architecture/build-pipeline.md`, and `src/build/README.md` so
      each states exactly what the code does after this change: a matched
      module deleted or replaced by a non-file between listing and
      validation is dropped and listed under `not searched` when its glob is
      then empty; a projection failure other than `ENOENT` is
      `config-invalid`.
- [x] Finding 2: restore to `docs/protocol/mokly-configuration.md` the full
      directory rule, "Other read or projection errors fail with
      `config-invalid`, naming the repository-relative path and error code
      (`unknown` if absent)", stated once, and delete the sentence "Other
      read errors also remain loud." Confirm `src/build/README.md` and
      `docs/architecture/build-pipeline.md` state the same rule in the same
      terms.
- [x] Run `cargo xtask check`, commit, and push.
- [x] Review the complete local diff against `origin/main` after the push
      using `docs/implementation-review-prompt.md`; report findings without
      changing the implementation. The post-push review reported two P3
      items, recorded under "Eighth Review Findings (deferred)"; it verified
      the symlink, permission, cost, test, and documentation questions.

## Eighth Review Findings (deferred)

Ownership transferred to
[Co-Located Entry Discovery Follow-up](./co-located-entry-discovery-follow-up.md).
The historical observations below are unchanged, including the residual note.

Review of the Milestone 13 commit. Both items are P3 hygiene and are deferred
with seventh-round findings 3 through 8. The reviewer confirmed that no
legitimately listed candidate can be dropped by the new type check, that
`EACCES` on the existence check is reported, that a module replaced by a
symlink is dropped rather than followed as documented, that the extra lstat is
immaterial, and that the three docs agree with the code.

1. **P3, two unwrapped lines** were added to the configuration contract
   paragraph that the sibling docs wrap; this widens deferred finding 8.
2. **P3, the test helper that mutates the filesystem after a directory
   listing fires on every listing** rather than once; a future second pass
   would fail loudly rather than falsely pass, so this is maintainability.
3. Residual note: the existence check now precedes the baseline-cache
   check, so a concurrently deleted module inside `.mokly-cache/` is dropped
   instead of reported; the more correct outcome, adjacent to deferred
   finding 5.

## Seventh Review Findings (1 and 2 approved in Milestone 13; 3 through 8 deferred)

Findings 3 through 8 are now owned by
[Co-Located Entry Discovery Follow-up](./co-located-entry-discovery-follow-up.md).
This section preserves the original observations, not a new implementation claim.

Review of the Milestone 12 commit. Nothing has been changed in response. The
supervising agent confirmed findings 1, 2, and 3 by direct probe. The reviewer
verified the single-validation and dual-glob counting, the vanished-module
accounting, the unchanged error text and sort order, the soundness of the
descriptor-exhaustion test including its second-pass `lstatSync` allowance,
and the three new discovery tests.

1. **P2, the deleted-module fix handles a narrower race than the docs
   claim.** `projectRealPath` projects a missing file lexically and never
   throws `ENOENT` for a module that was simply deleted after the walk
   listed it; such a module is returned in the resolved set and fails later
   at bundling. Only the narrow window where `lstat` succeeds and `realpath`
   then fails is handled, which the new tests reach by mocking. Confirmed by
   deleting a file immediately after the directory listing. Recommended:
   also treat a candidate whose `lstat` now fails with `ENOENT` as vanished,
   add a test that really deletes the file between walk and validation, and
   narrow the three doc sentences to what the code does.
2. **P2, the configuration contract lost the directory error rule.** The
   sentence stating that other read or projection errors fail with
   `config-invalid` naming the path and code was folded into the module
   sentence, leaving directories with only "Other read errors also remain
   loud", weaker than the README and pipeline docs. Recommended: restore
   the full sentence and delete the vague one.
3. **P2, plan history deleted outside the milestone.** The Status And
   Outcome paragraph and the sixth-round preamble were rewritten, erasing
   the Milestone 11 gate record, the permission-probe note, and the
   reviewer's verified-items list. Recommended: restore both paragraphs.
4. **P3, the commit-and-push TODO was reworded to drop "push"** and ticked
   before any push. Recommended: restore the wording.
5. **P3, error precedence changed silently.** Validating inside the per-glob
   loop lets a denied module under an earlier glob pre-empt a later glob's
   zero-match error. Recommended: document and pin with a test.
6. **P3, the `not searched` placeholder says roots but now lists files.**
7. **P3, two explanatory sentences were dropped** from the configuration
   paragraph: why `dist/entries/**` is discoverable, and that per-glob
   validation is what prevents silent omissions.
8. **P3, ragged mid-paragraph line wraps** in two reflowed docs.

## Sixth Review Findings (approved, addressed in Milestone 12)

The Milestone 11 review verified the five forwarded chokidar event kinds, both
coalescing orders, discovery's error contract, and the documented pre-existing
raw-rename degradation under descriptor exhaustion. Approved fixes follow.

1. **P2, a matched module that vanishes mid-pass fails the config.** The
   walk tolerates a directory that disappears, but the per-module denial
   loop rethrows every projection failure, including `ENOENT`, so an entry
   deleted between the walk and the loop, the window an atomic editor save
   opens during watched Serve, aborts the reload. Recommended: skip a module
   that vanished with `ENOENT` through the shared vanished-directory helper
   and keep `ENOTDIR` loud.
2. **P2, the descriptor-exhaustion test cannot fail** on its fail-open
   branch: it asserts only that the predicate does not throw, and the
   milestone asked for `lstatSync`, `readFileSync`, and `openSync` to be
   mocked alongside `statSync`, which was not done although the TODO is
   ticked. Recommended: assert the fail-open value and add the three mocks.
3. **P3, duplicated doc comments** in `tests/helpers/watch_config.ts` bind
   the wrong description to two factory classes.
4. **P3, a source-text regex** stands in for a behavioural test that the
   mode mask is gone; the permission-probe test already proves it.
   Recommended: delete the regex test.
5. **P3, traversal gained one guarded `statSync`** for denied-name leaves
   when chokidar supplies no stats; documented, accepted as the better
   pruning behaviour.
6. **P3, check-order swap** changes only a diagnostic: a Review output
   directory named like a denied segment is now listed as not searched.
   Accept.
7. **P3, hygiene.** The plans index entry was stale (corrected now); the
   plan split into a history subdirectory is a convention CLAUDE.md does not
   state; one README line reflowed long; one non-null assertion in
   `entry_discovery_paths.ts`.

## Fifth Review Findings (approved, addressed in Milestone 11)

Findings from the Milestone 10 review, addressed by Milestone 11. The
supervising agent confirmed findings 1, 2, and 3 by direct probe.

1. **P1, an existing denied directory no longer outranks user watch rules.**
   `classifyWatchPath` calls the prune predicate without stats, so an event
   on an existing `src/dist` under `src/**` is not recognised as a denied
   directory and falls through to `watch.rules`; with a rule covering
   `src/**` it now classifies `reload` where it used to be `ignore`. This
   contradicts the unchanged contract sentence that package-owned
   classifications take precedence over additional watch rules. Recommended:
   in event mode, fall back to a fail-open directory check when stats are
   absent, using supplied traversal stats when available.
2. **P2, deleting a matched entry module named like a denied directory is
   ignored.** A removed path cannot be told apart from a removed directory,
   so deleting `src/target` under a suffix-less glob leaves its page in the
   catalogue until an unrelated rebuild; one test asserts this inside a test
   whose name says the opposite. Recommended: thread chokidar's event kind
   through `ConsumerWatcher.onChange` so `unlink` and `unlinkDir` are exact,
   and drop the missing-path heuristic; document the limitation meanwhile.
3. **P2, discovery now swallows every read error.** `readEntryDirectory`
   returns nothing on any failure, so an `EACCES` or `EIO` mid-walk silently
   drops entries, and the transactional writer then prunes their generated
   output as orphans. Before this commit the failure was loud. An unreadable
   glob root reports a misleading zero-match message. Recommended: swallow
   only `ENOENT` and `ENOTDIR`, surface other errors as `config-invalid`, and
   list skipped directories in the zero-match message.
4. **P2, doc and test overstate "no filesystem I/O".** The prune predicate
   still reads export markers and ownership headers; only the denied-leaf
   directory check is stat-free. Recommended: scope the sentence and the
   test name, then extend the `EMFILE` test to mock the other calls.
5. **P3, the directory mode mask is redundant and wrong under root.** A
   `0o000` directory is readable by root yet is now skipped silently; the
   catch already guards every other case. Recommended: delete the check.
6. **P3, "resolve once" is only half applied.** The `review.outDir`
   projection at the top of discovery is unguarded, so a permission error on
   an ancestor still escapes `loadConfig`, and per-module real-path
   projections remain. Recommended: guard the projection with a lexical
   fallback, then hoist the remaining projections.
7. **P3, two coverage gaps**: no test proves a deleted matched module with an
   ordinary name still rebuilds, and nothing exercises the non-`Error` wrap in
   the resource watcher's reporter.

## Post-merge follow-up (non-blocking)

The component-library adoption protocol/plan and published-release monorepo
consumer smoke test are transferred, still unimplemented, to the
[follow-up plan's non-blocking section](./co-located-entry-discovery-follow-up.md#post-merge-follow-up-non-blocking).
