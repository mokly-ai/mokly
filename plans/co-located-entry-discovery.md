# Co-Located Entry Discovery

## Status And Outcome

Planned. No milestone has started.

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
  inside `mockupsDir`, `review.outDir`, `.mokly-cache/`, a package-owned
  ignored directory, or outside `repoRoot` after realpath resolution.
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
  - Only files ending in `.mockup.ts` or `.mockup.tsx` are entry modules, even
    when a glob would match other names; a glob matching only other names
    counts as zero matches. This keeps helper modules beside entries from
    being evaluated as registries.
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

### Milestone 1: Define the contract in the protocol docs

Update the protocol and architecture documents so they fully specify glob-based
discovery, repository-wide facade binding, and the replacement of every
`entriesDir` containment rule before any code changes.

- [ ] In `docs/protocol/mokly-configuration.md`, replace the `entriesDir`
      field description with `entries` globs plus the `entriesDir` sugar,
      the both-supplied error, the zero-match error, the resolved-match
      classification rules, sort order, and the `.mockup.{ts,tsx}` filter.
      Update the source/output overlap paragraph to describe per-match checks.
- [ ] In `docs/protocol/mokly-authoring.md`, replace the facade paragraph so
      binding covers every repository-owned module and attribution names the
      defining module, including helpers outside any glob.
- [ ] In `docs/protocol/mokly-source-protection.md`, replace "beneath
      `entriesDir`" with membership in the resolved entry set, keep the
      `sourceFiles` rule, and update the retained-unimported-helper guidance to
      use a reserved basename or a public exclusion, or to be matched by an
      `entries` glob.
- [ ] In `docs/protocol/mokly-watch.md`, replace the entry-directory rebuild
      rule with resolved entry modules plus `sourceFiles`, and specify that a
      newly created file matching an `entries` glob triggers a rebuild that
      re-runs discovery.
- [ ] In `docs/protocol/mokly-export.md` and
      `docs/protocol/mokly-baseline-storage.md`, replace `entriesDir`
      confinement with the resolved entry set and inventoried sources.
- [ ] In `docs/protocol/mokly-page-migration.md` and
      `docs/protocol/mokly-package.md`, update the ownership-header owner and
      the recommended layout so co-location beside product components is the
      documented alternative to the sibling `docs/mockups` layout.
- [ ] In `docs/architecture/build-pipeline.md`, describe glob discovery,
      repository-wide facade binding, and the per-match classifier.
- [ ] Add a Delivery Status note to each changed protocol document pointing at
      this plan until the implementation lands.
- [ ] Run `npm run format:check` on the changed Markdown, review the diff,
      commit, and push.

---

### Milestone 2: Config field and glob discovery

Add the `entries` config field, resolve globs into a validated entry-module
set, and make discovery consume that set. At the end of this milestone the
existing `entriesDir` configurations behave exactly as before.

- [ ] Add `entries?: readonly string[]` to `MoklyConfig` and make
      `entriesDir` optional; require exactly one of them.
- [ ] Add `entryGlobs: readonly string[]` and
      `entryModules: readonly string[]` to `ResolvedConfig`. `entryGlobs` is
      the validated ordered list; `entryModules` is the sorted resolved set
      filled by discovery so later stages never re-glob.
- [ ] Validate each glob with the existing relative-route rules, reject
      duplicates, absolute paths, and escaping segments, and reject globs whose
      stable prefix resolves to `.mokly-cache/`.
- [ ] Implement discovery that walks each glob's stable prefix, matches with
      `minimatch` using the same options as `review.sharedImpact`, keeps only
      `.mockup.ts` and `.mockup.tsx` files, and sorts the union.
- [ ] Fail with a config error naming the glob when it matches zero entry
      modules.
- [ ] Run the existing source classifier over every resolved module and fail
      with the module path and the matched denial when a module is inside
      `mockupsDir`, `review.outDir`, `.mokly-cache/`, a package-owned ignored
      directory, or resolves outside `repoRoot` through a symlink.
- [ ] Replace `validateSourceRoots` with a per-match overlap check while
      keeping the `entriesDir` sugar path producing the same errors for the
      same directories.
- [ ] Add failing-first tests for: sugar equivalence, both-supplied error,
      zero-match error, non-`.mockup` matches counting as zero, sort order
      independence from glob order, and each denial category.
- [ ] Update the config-related crate and package READMEs that document
      configuration fields.
- [ ] Run `cargo xtask check`, commit, and push.

---

### Milestone 3: Repository-wide facade binding and attribution

Bind the attributed authoring facade to every repository-owned module and
relax entry attribution so a definition is attributed to its defining module
wherever that module lives.

- [ ] Change the package API plugin so imports of `@mokly/mokly` from any
      real path inside `repoRoot`, excluding `node_modules`, `.mokly-cache/`,
      and Mokly's own runtime directories, receive the attributed facade keyed
      by the importer's repository-relative path.
- [ ] Keep the plain package index for importers outside those boundaries so
      installed packages cannot self-attribute.
- [ ] Replace the `invalid-source` rule in registry entry validation with:
      the source path must be a safe repository-relative path, must be a
      regular file inside `repoRoot`, and must appear in the resolved entry
      set or the `sourceFiles` inventory.
- [ ] Update the registry violation message and the shared source-denial
      message so neither names `entriesDir`.
- [ ] Add failing-first tests for: a `defineComponent` call in a helper beside
      a product component attributed to that helper, a `defineScreen` call in
      a helper outside every glob attributed to the helper and accepted
      because the helper is inventoried, a definition created by an installed
      package rejected as unattributed, and byte-identical manifests for the
      existing `entriesDir` fixtures.
- [ ] Run `cargo xtask check`, commit, and push.

---

### Milestone 4: Ownership, watch, export, and runtime boundaries

Replace the remaining `entriesDir` containment checks with the resolved entry
set and inventoried sources so generated ownership, tracked ownership, watch
classification, export confinement, and the component runtime all agree.

- [ ] In generated ownership validation and tracked Git ownership, accept an
      owner that is a resolved entry module or an inventoried source file
      inside `repoRoot`, and reject anything else with the existing messages.
- [ ] In watch classification, treat the resolved entry modules as required
      rebuild inputs, add each glob's stable prefix to the watched roots, and
      re-run discovery on a created or deleted file that matches a glob.
- [ ] In export resource policy and the export destination rules, replace the
      `entriesDir` root with the set of directories containing resolved entry
      modules and inventoried sources, keeping the existing denial reasons.
- [ ] In the component runtime IPC startup message, replace the `entriesDir`
      string check with `entryModules` array validation.
- [ ] Remove `entriesDir` from `ResolvedConfig` once no runtime reads it;
      keep it only as a config input field.
- [ ] Add failing-first tests for: a generated document owned by a co-located
      entry accepted and one owned by a non-inventoried file rejected, watch
      rebuild on a new co-located entry file, export refusing a destination
      containing a co-located entry directory, and runtime IPC rejecting a
      startup message without `entryModules`.
- [ ] Run `cargo xtask check`, commit, and push.

---

### Milestone 5: Co-locate the basic example components

Prove the layout in the repository's own consumer by moving the example's
registered Action and Toolbar components beside a product-style component
directory and discovering them through a second glob.

- [ ] Create `examples/basic/src/components/` holding the Action and Toolbar
      implementations, their `defineComponent` registrations, and
      `action.mockup.tsx` and `toolbar.mockup.tsx` entry modules beside them.
- [ ] Change `examples/basic/mokly.config.ts` to discover both roots with an
      `entries` list: the existing entries glob
      `examples/basic/entries/**/*.mockup.{ts,tsx}` and the new co-located glob
      `examples/basic/src/components/**/*.mockup.{ts,tsx}`.
- [ ] Update the example's `catalogue.mockup.tsx`, dependency declarations,
      `sharedImpact` globs, and the Components collection so routes, ids, and
      saved variants are unchanged.
- [ ] Update `examples/basic/README.md` and the example notes.
- [ ] Run `npm run build`, `npm run example:build`, and
      `npm run example:check`, then smoke-test the Action and Toolbar pages,
      their Used by data, and a screen inspection through `npm run dev`.
- [ ] Add a packed-consumer test that discovers a co-located entry through a
      second glob and builds it with the published package layout.
- [ ] Run `cargo xtask check`, commit, and push.

---

### Milestone 6: Guides, README, and changelog

Bring the user-facing documentation in line with the delivered behavior and
remove the Delivery Status notes added in Milestone 1.

- [ ] Update `docs/guides/start/configure.md`,
      `docs/guides/authoring/config.md`, and
      `docs/guides/start/your-first-screen.md` to present `entries` globs with
      co-location as the primary layout and `entriesDir` as the shorthand.
- [ ] Update `docs/guides/authoring/components.md` with a co-located
      component example.
- [ ] Update the workspace `README.md` configuration example and the
      `src/components/README.md` authoring notes.
- [ ] Remove the Milestone 1 Delivery Status notes from the changed protocol
      documents and confirm every document describes implemented behavior.
- [ ] Add a changelog entry under the unreleased heading describing the new
      field, the retained shorthand, and the facade binding change.
- [ ] Run `cargo xtask check`, commit, and push.
- [ ] Review the complete local diff against `origin/main` after the push
      using `docs/implementation-review-prompt.md`. Report each finding with a
      number, severity, context, impact of doing nothing, lettered options,
      and a recommendation. Do not change the implementation.

## Post-merge follow-up (non-blocking)

- Write the component-library adoption protocol document and plan, covering an
  explicit adoption helper in the attributed facade, package-version
  dependency evidence in Changes, provider composition in the consumer
  renderer, and package naming.
- Smoke-test a consumer repository that uses a monorepo workspace package as a
  glob root with the published package release.
