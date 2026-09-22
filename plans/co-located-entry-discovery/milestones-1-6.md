# Co-Located Entry Discovery: Milestones 1 through 6

Historical appendix to the [owning plan](../co-located-entry-discovery.md).

### Milestone 1: Define the contract in the protocol docs - completed

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

### Milestone 2: Config field and glob discovery - completed

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

### Milestone 3: Repository-wide facade binding and attribution - completed

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

### Milestone 4: Ownership, watch, export, and runtime boundaries - completed

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

### Milestone 5: Co-locate the basic example components - completed

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

### Milestone 6: Guides, README, and changelog - completed

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
