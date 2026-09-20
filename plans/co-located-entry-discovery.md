# Co-Located Entry Discovery

## Status And Outcome

Milestones 1 through 9 are complete, committed, and pushed. Milestone 9
resolved all six third-review findings, including watcher isolation, combined
zero-match diagnostics, basename handling, Review-output pruning, and the
documented duplicate-registration contract. The post-push review of Milestone
9 reported seven further findings, all P2 or P3, recorded below and awaiting
the user's decision.

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

### Milestone 1: Define the contract in the protocol docs — completed

Update the protocol and architecture documents so they fully specify glob-based
discovery, repository-wide facade binding, and the replacement of every
`entriesDir` containment rule before any code changes.

- [x] In `docs/protocol/mokly-configuration.md`, replace the `entriesDir`
      field description with `entries` globs plus the `entriesDir` sugar,
      the both-supplied error, the zero-match error, the resolved-match
      classification rules, sort order, and the `.mockup.{ts,tsx}` filter.
      Update the source/output overlap paragraph to describe per-match checks.
- [x] In `docs/protocol/mokly-authoring.md`, replace the facade paragraph so
      binding covers every repository-owned module and attribution names the
      defining module, including helpers outside any glob.
- [x] In `docs/protocol/mokly-source-protection.md`, replace "beneath
      `entriesDir`" with membership in the resolved entry set, keep the
      `sourceFiles` rule, and update the retained-unimported-helper guidance to
      use a reserved basename or a public exclusion, or to be matched by an
      `entries` glob.
- [x] In `docs/protocol/mokly-watch.md`, replace the entry-directory rebuild
      rule with resolved entry modules plus `sourceFiles`, and specify that a
      newly created file matching an `entries` glob triggers a rebuild that
      re-runs discovery.
- [x] In `docs/protocol/mokly-export.md` and
      `docs/protocol/mokly-baseline-storage.md`, replace `entriesDir`
      confinement with the resolved entry set and inventoried sources.
- [x] In `docs/protocol/mokly-page-migration.md` and
      `docs/protocol/mokly-package.md`, update the ownership-header owner and
      the recommended layout so co-location beside product components is the
      documented alternative to the sibling `docs/mockups` layout.
- [x] In `docs/architecture/build-pipeline.md`, describe glob discovery,
      repository-wide facade binding, and the per-match classifier.
- [x] Add a Delivery Status note to each changed protocol document pointing at
      this plan until the implementation lands.
- [x] Run `npm run format:check` on the changed Markdown, review the diff,
      commit, and push.

---

### Milestone 2: Config field and glob discovery — completed

Add the `entries` config field, resolve globs into a validated entry-module
set, and make discovery consume that set. At the end of this milestone the
existing `entriesDir` configurations behave exactly as before.

- [x] Add `entries?: readonly string[]` to `MoklyConfig` and make
      `entriesDir` optional; require exactly one of them.
- [x] Add `entryGlobs: readonly string[]` and
      `entryModules: readonly string[]` to `ResolvedConfig`. `entryGlobs` is
      the validated ordered list; `entryModules` is the sorted resolved set
      filled by discovery so later stages never re-glob.
- [x] Validate each glob with the existing relative-route rules, reject
      duplicates, absolute paths, and escaping segments, and reject globs whose
      stable prefix resolves to `.mokly-cache/`.
- [x] Implement discovery that walks each glob's stable prefix, matches with
      `minimatch` using the same options as `review.sharedImpact`, keeps only
      `.mockup.ts` and `.mockup.tsx` files, and sorts the union.
- [x] Fail with a config error naming the glob when it matches zero entry
      modules.
- [x] Run the existing source classifier over every resolved module and fail
      with the module path and the matched denial when a module is inside
      `mockupsDir`, `review.outDir`, `.mokly-cache/`, a package-owned ignored
      directory, or resolves outside `repoRoot` through a symlink.
- [x] Replace `validateSourceRoots` with a per-match overlap check while
      keeping the `entriesDir` sugar path producing the same errors for the
      same directories.
- [x] Add failing-first tests for: sugar equivalence, both-supplied error,
      zero-match error, non-`.mockup` matches counting as zero, sort order
      independence from glob order, and each denial category.
- [x] Update the config-related crate and package READMEs that document
      configuration fields.
- [x] Run `cargo xtask check`, commit, and push.

---

### Milestone 3: Repository-wide facade binding and attribution — completed

Bind the attributed authoring facade to every repository-owned module and
relax entry attribution so a definition is attributed to its defining module
wherever that module lives.

- [x] Change the package API plugin so imports of `@mokly/mokly` from any
      real path inside `repoRoot`, excluding `node_modules`, `.mokly-cache/`,
      and Mokly's own runtime directories, receive the attributed facade keyed
      by the importer's repository-relative path.
- [x] Keep the plain package index for importers outside those boundaries so
      installed packages cannot self-attribute.
- [x] Replace the `invalid-source` rule in registry entry validation with:
      the source path must be a safe repository-relative path, must be a
      regular file inside `repoRoot`, and must appear in the resolved entry
      set or the `sourceFiles` inventory.
- [x] Update the registry violation message and the shared source-denial
      message so neither names `entriesDir`.
- [x] Add failing-first tests for: a `defineComponent` call in a helper beside
      a product component attributed to that helper, a `defineScreen` call in
      a helper outside every glob attributed to the helper and accepted
      because the helper is inventoried, a definition created by an installed
      package rejected as unattributed, and byte-identical manifests for the
      existing `entriesDir` fixtures.
- [x] Run `cargo xtask check`, commit, and push.

---

### Milestone 4: Ownership, watch, export, and runtime boundaries — completed

Replace the remaining `entriesDir` containment checks with the resolved entry
set and inventoried sources so generated ownership, tracked ownership, watch
classification, export confinement, and the component runtime all agree.

- [x] In generated ownership validation and tracked Git ownership, accept an
      owner that is a resolved entry module or an inventoried source file
      inside `repoRoot`, and reject anything else with the existing messages.
- [x] In watch classification, treat the resolved entry modules as required
      rebuild inputs, add each glob's stable prefix to the watched roots, and
      re-run discovery on a created or deleted file that matches a glob.
- [x] In export resource policy and the export destination rules, replace the
      `entriesDir` root with the set of directories containing resolved entry
      modules and inventoried sources, keeping the existing denial reasons.
- [x] In the component runtime IPC startup message, replace the `entriesDir`
      string check with `entryModules` array validation.
- [x] Remove `entriesDir` from `ResolvedConfig` once no runtime reads it;
      keep it only as a config input field.
- [x] Add failing-first tests for: a generated document owned by a co-located
      entry accepted and one owned by a non-inventoried file rejected, watch
      rebuild on a new co-located entry file, export refusing a destination
      containing a co-located entry directory, and runtime IPC rejecting a
      startup message without `entryModules`.
- [x] Run `cargo xtask check`, commit, and push.

---

Milestones 2, 3, and 4 were delivered in one commit. The shared entry-membership
helper that replaces `entriesDir` containment is used by attribution, generated
ownership, watch classification, and export confinement at once, so splitting
them would have left the build failing between commits. Two planned details
changed during implementation:

- `entriesDir` stays on `ResolvedConfig` as an optional field alongside
  `entryGlobs` and `entryModules`, because the shorthand still protects the
  whole directory as authored source, exactly as before. Only the required
  string field was removed.
- The `.mockup.{ts,tsx}` filter uses the `entries` glob matching rules, and
  private directories are `node_modules`, `.git`, and `.mokly-cache/`;
  `dist`, `target`, and `.context` remain valid entry roots because existing
  watch fixtures nest sources under them intentionally.

---

### Milestone 5: Co-locate the basic example components — completed

Prove the layout in the repository's own consumer by moving the example's
registered Action and Toolbar components beside a product-style component
directory and discovering them through a second glob.

- [x] Create `examples/basic/src/components/` holding the Action and Toolbar
      implementations, their `defineComponent` registrations, and
      `action.mockup.tsx` and `toolbar.mockup.tsx` entry modules beside them.
- [x] Change `examples/basic/mokly.config.ts` to discover both roots with an
      `entries` list: the existing entries glob
      `examples/basic/entries/**/*.mockup.{ts,tsx}` and the new co-located glob
      `examples/basic/src/components/**/*.mockup.{ts,tsx}`.
- [x] Update the example's `catalogue.mockup.tsx`, dependency declarations,
      `sharedImpact` globs, and the Components collection so routes, ids, and
      saved variants are unchanged.
- [x] Update `examples/basic/README.md` and the example notes.
- [x] Run `npm run build`, `npm run example:build`, and
      `npm run example:check`, then smoke-test the Action and Toolbar pages,
      their Used by data, and a screen inspection through `npm run dev`.
- [x] Add a packed-consumer test that discovers a co-located entry through a
      second glob and builds it with the published package layout.
- [x] Run `cargo xtask check`, commit, and push.

---

Milestone 5 notes: the Action and Toolbar registrations moved to
`examples/basic/src/components/{action,toolbar}/*.mokly.tsx` beside plain
`action.tsx` and `toolbar.tsx` implementations, each exported by a sibling
`*.mockup.tsx` entry module discovered through a second `entries` glob. Routes,
ids, variants, and recorded usage are unchanged; the generated Action and
Toolbar pages, all three Action variants, and Welcome's recorded Action and
Toolbar instances were smoke-tested through `mokly serve`. Two implementation
details were added during this milestone: discovery now also runs when the
configuration is resolved, so every resolved config carries `entryModules`,
and a generated document whose recorded owner lies beneath a directory holding
a resolved entry module remains replaceable, so moving or renaming an entry
module never strands its previous output.

`cargo xtask check` crashed twice in `tests/watch_resource_boundaries.test.ts`
with a Node 24 fatal `v8::ToLocalChecked Empty MaybeLocal` inside
`cjs_lexer::Parse` while loading a CommonJS module; the file passes in
isolation and the complete unit suite and two further full gate runs passed
without the crash. It is recorded here as an intermittent runtime fault to
watch for, not a defect in this change.

---

### Milestone 6: Guides, README, and changelog — completed

Bring the user-facing documentation in line with the delivered behavior and
remove the Delivery Status notes added in Milestone 1.

- [x] Update `docs/guides/start/configure.md`,
      `docs/guides/authoring/config.md`, and
      `docs/guides/start/your-first-screen.md` to present `entries` globs with
      co-location as the primary layout and `entriesDir` as the shorthand.
- [x] Update `docs/guides/authoring/components.md` with a co-located
      component example.
- [x] Update the workspace `README.md` configuration example and the
      `src/components/README.md` authoring notes.
- [x] Remove the Milestone 1 Delivery Status notes from the changed protocol
      documents and confirm every document describes implemented behavior.
- [x] Add a changelog entry under the unreleased heading describing the new
      field, the retained shorthand, and the facade binding change. Not
      applicable: `CHANGELOG.md` is generated by release-please from
      Conventional Commits and is excluded from formatting, so the `feat(config)`
      commit message carries the entry instead.
- [x] Run `cargo xtask check`, commit, and push.
- [x] Review the complete local diff against `origin/main` after the push
      using `docs/implementation-review-prompt.md`. Report each finding with a
      number, severity, context, impact of doing nothing, lettered options,
      and a recommendation. Do not change the implementation.

---

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

## Fourth Review Findings (awaiting decision)

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

## Post-merge follow-up (non-blocking)

- Write the component-library adoption protocol document and plan, covering an
  explicit adoption helper in the attributed facade, package-version
  dependency evidence in Changes, provider composition in the consumer
  renderer, and package naming.
- Smoke-test a consumer repository that uses a monorepo workspace package as a
  glob root with the published package release.
