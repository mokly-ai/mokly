# Per-Entry Render Keys

Status: Active. On branch
`conductor/perf-4-per-entry-render-keys-and-cross-side-fragment-reuse`, no
pull request yet. The plan closes when its PR merges.

One JavaScript edit re-renders every JavaScript document, and an unchanged
base renders every base document through the sidecars again. Both come from
one value. The core hashes the sidecar's generation id, the CSS Modules class
maps digest, and the binding table into one fingerprint for the whole
catalogue. Every fragment key and every JavaScript document key contains it.
The generation id hashes the bytes of every bundled module and the real
source root. So one comment line in one screen module moves every key, and
equal head and base sources never share a key.

This plan replaces the fingerprint in fragment and document keys with a
render input key for each entry module. The key covers the inputs that can
change the sidecar renders of that module's definitions, and no absolute
source root. Sidecar generations stay separate, so a cache miss still renders
with its own side's generation. The plan covers items 6 and 9 of the startup
performance profile. It does not cover the render cache weight (perf 0), the
background pass (perf 3), the base preparation (perf 2 and perf 6), or the
comparison of views whose two keys are equal, which could skip the tree
comparison in a later change.

User decisions recorded on 2026-10-27, before this plan:

- Item 6, option A: replace the fingerprint with a per-entry value built from
  the module digests and the module graph, plus the class maps of the CSS
  Modules in the closure, the entry's binding, and the bindings of the
  definitions in the closure. The render request keeps the generation id. The
  live generation keeps hashing every document key.
- Item 9, option A: derive the fragment and document keys from a content
  identity without the root path, and keep separate sidecar generations for
  the misses.

Contract owners:

- [Rust core architecture](../docs/architecture/rust-core.md), render graph.
- [Watch contract](../docs/protocol/mokly-watch.md), invalidation.
- [Sidecar contract](../docs/protocol/mokly-sidecar.md), bundling.
- [Sidecar module sources](../docs/protocol/mokly-sidecar-modules.md),
  authoring and evaluation.
- [Runtime contract](../docs/protocol/mokly-runtime.md), render graph and
  cache.
- The [authoring guide](../docs/guides/authoring/screens.md) and the
  [serve guide](../docs/guides/cli/serve.md).
- The [mokly-graph README](../crates/mokly-graph/README.md) and the
  [mokly-render README](../crates/mokly-render/README.md).

## Open Decisions

The decisions message of 2026-10-27 asks these. Each answer is recorded here
with its date. Without an answer, the recommended option applies.

1. Cross-side render cache rule. Recommended: A, share entries across sides
   through content keys. B adds a side marker to every key.
2. Package identity across sides, only with decision 1 A. Recommended: A, the
   key keeps the selected installation's directories, so a base with its own
   installation shares nothing. B adds logical package digests from the
   sidecar.
3. Scope of the resolution files. Recommended: A, one digest of every
   resolution file in every key. B scopes the files to each closure. C leaves
   them out.
4. Bundler name renaming. Recommended: A, bundle with esbuild `keepNames`. B
   documents the limit only.
5. Bundle fingerprint in the live generation. Recommended: A, keep it. B
   drops it.

## Corrections And Planning Findings

- The live generation is in `crates/mokly-graph/src/graph.rs:273`, not in
  `crates/mokly-render/src/graph.rs`.
- A saved slot always belongs to the module of the definition that saves it:
  its handle is the definition handle plus a slot suffix. "A saved slot from
  another module" is a saved React value that renders a definition imported
  from another module. That module is in the closure.
- The [module sources contract](../docs/protocol/mokly-sidecar-modules.md#authoring-and-evaluation)
  says that bundle parsing ignores package `type` and `tsconfig.json` parse
  settings. Resolution files therefore change a render only through module
  resolution, which the module graph records, and through package
  `sideEffects`. Decision 3 uses this.
- The item lists three gaps. Planning found a fourth: esbuild renames
  colliding top-level names across modules. A test on 2026-10-27 bundled two
  modules that both declare `function Button`. Without `keepNames`, the
  second became `Button2` in `Function.name` and in stack traces. With
  `keepNames`, both kept `Button`. A story title falls back to its
  component's function name, and Emotion's development labels for the `css`
  prop read stack traces, so an unrelated module can change these renders.
  Decision 4 uses this.
- The cache can hold a document with the closure warnings of the side that
  read it last. A base-only `base-conversion` warning can then reach the
  head. Milestone 5 fixes this before sides share JavaScript keys.

## Design

### Render input key

The render input key of an entry module is a domain-separated digest of
this explicit input list:

1. Closure records. The closure is the entry module and every module that it
   imports, directly or through other modules, from the module graph of its
   own side. Add the renderer module's closure for every entry module, and
   the Storybook preview module's closure instead for every stories file,
   because stories render without the renderer. Each record is
   the logical path, the ordered imports, and one content value: the
   consumed-byte digest for a JavaScript module, the class map digest for a
   CSS Module, and nothing for other stylesheets. Stylesheet bytes reach
   documents through stylesheet keys, as today.
2. Bindings. The path and title of every binding whose handle's module is in
   the closure. This covers the entry's own binding, the components it uses,
   and its link targets.
3. Bundle environment, one digest shared by every key of a side:
   - the bundle settings except the source root and the entry and stories
     file lists: module resolution, repository roots, configuration
     directory, and renderer path;
   - under decision 2 A, the selected dependency directories and the
     resolved peer packages;
   - under decision 3 A, every logical resolution input except the preview
     candidates, with the reserved installed-input prefix removed, so that a
     base that reads the working installation names its files as the head
     does.

No closure record and no binding contains a source root. Under decision 2 A,
the environment names the installation, not the source root. Equal inputs on
two sides that read one installation therefore give equal keys.

### Keys that use it

- A fragment key replaces the fingerprint with the render input key of the
  handle's module. The other fragment inputs do not change: handle,
  effective entry path and title, saved slots, props, render kind, viewport,
  colour scheme, ignore scope, and placeholder tokens.
- A document key replaces the fingerprint with the sorted, deduplicated
  render input keys of the JavaScript definitions that the document renders:
  the entry's own definition and every JavaScript component that its HTML
  templates and slots reach.
- A handle or component whose module has no key uses the whole-bundle
  fingerprint. That fallback can only over-invalidate.
- The live generation keeps hashing the config key and every document and
  resource key. Under decision 5 A it also keeps the bundle fingerprint.

### Unsupported inputs

The guides and the architecture page name these. A render that depends on
them can keep a stale cached result:

- A module-level side effect of one entry module that changes another entry
  module's render, such as a setup module that installs a date mock. The
  workaround is to import the setup module from each entry module that needs
  it.
- A read during a render of anything that is not an import, a prop, a slot,
  or the render context, such as files, environment variables, the clock, or
  random values.

No escape hatch keeps the whole-bundle key. Planning found no supported case
that needs it. The first unsupported case has the workaround above. The
second is unsupported today too: its first result stays cached until the
next rebundle.

### Expected key movement

The integration tests use a fixture with screen S, which imports helper H
and component C and links to screen T, component C with a CSS Module and a
saved slot that renders definition P, an HTML screen that uses C, an
unrelated screen U, a stories file with a preview, and a renderer.

| Edit                                           | Keys that move                   | Keys that stay               |
| ---------------------------------------------- | -------------------------------- | ---------------------------- |
| module edit: comment line in H                 | S                                | C, P, T, U, stories          |
| dependency upgrade: module bytes used by C     | C, S, the HTML screen            | P, T, U, stories             |
| dependency upgrade: its manifest, decision 3 A | every JavaScript key             | HTML-only documents          |
| resolution file edit, decision 3 A             | every JavaScript key             | HTML-only documents          |
| preview edit                                   | stories                          | S, C, P, T, U                |
| class map change: class added to C's module    | C, S, the HTML screen            | P, T, U, stories             |
| slot provider edit: P's module                 | P, C, S, the HTML screen         | T, U, stories                |
| link target rename: folder record that moves T | S, and T's routes are replaced   | C, P, U, stories             |
| renderer edit                                  | every JavaScript key but stories | stories, HTML-only documents |

## Baseline

Release build of `a9dd1e81`, the merge base, on 2026-10-27, 8 cores, 8
sidecars, warm OS cache. The `examples/basic` medians are over six first
passes and three edit runs. The React medians are over two runs. Records and
logs are in `.context/perf/before-*`.

| Phase                                        | examples/basic      | React fixture |
| -------------------------------------------- | ------------------- | ------------- |
| `serve.ready`                                | 19.8 s              | 10.3 s        |
| `serve.background`                           | 18.4 s, 554 renders | 2.8 s, 162    |
| `changes.classify`                           | 71.3 s              | 13.4 s        |
| `review.base-tree`                           | 43.7 s              | 12.9 s        |
| `review.capture-side`                        | 6.7 s, 549 renders  | 1.5 s, 162    |
| `review.compare-views`                       | 26.2 s, about 1,070 | 0.4 s, 0      |
| `sidecar.render` count, whole run            | 2,175               | 324           |
| `css.bundle` count and union                 | 152, 14.2 s         | 12, 0.4 s     |
| `watch.action` after one edit                | 13.5 s              |               |
| `serve.background` after the edit            | 18.9 s, 554 renders |               |
| `changes.classify` after the edit            | 88.5 s              |               |
| edit to the end of the second classification | 120.2 s             |               |
| `build` index keys changed by the edit       | 549 of 590, 0 bytes |               |

The cold run gave `serve.ready` 19.8 s, `serve.background` 17.6 s, and
`changes.classify` 138.9 s. The renders column counts `sidecar.render`
records inside the phase.

## Milestone 1: Documentation and protocol

State the render input contract and the decisions, with a status line on
each page until its behaviour is implemented.

- [ ] Update the render graph section of `docs/architecture/rust-core.md`:
      a JavaScript definition's keys use its module's render input key, the
      input list in summary, the unsupported inputs, and the cross-side rule
      of decision 1.
- [ ] Update the invalidation section of `docs/protocol/mokly-watch.md`: a
      JavaScript edit rebundles once and re-renders only the definitions
      whose render input key moved, with one rule for each input kind of the
      design table. Update the watch input table.
- [ ] Update the bundling section of `docs/protocol/mokly-sidecar.md`:
      generations, class maps, and bindings stay per side, and render cache
      keys follow decision 1. Keep the page under 250 lines.
- [ ] Update the render graph and cache section of
      `docs/protocol/mokly-runtime.md`: both sides share the render cache,
      equal keys share entries in both directions under decision 1, and a
      cached document carries no side-specific warning.
- [ ] Update the authoring and evaluation section of
      `docs/protocol/mokly-sidecar-modules.md` under decision 4.
- [ ] Leave the crate READMEs and the guides to the milestones that change
      the code, because they describe released behaviour and entry points.
- [ ] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 2: Stable bundle names

Keep authored function and class names in the bundle under decision 4, so
that no module outside a closure can change a render through renaming.

- [ ] Add a failing sidecar test first: two entry modules declare the same
      top-level function. A render that prints its `name` and its stack
      frame name shows the authored name for both, and a stories file
      without a title keeps its component's authored name as its title.
- [ ] Bundle with `keepNames` in `packages/mokly/src/sidecar/bundle.ts`.
      perf 1 changes the same file, so keep the change to the options.
- [ ] Remove the status line of `docs/protocol/mokly-sidecar-modules.md`.

## Milestone 3: Render input keys

Compute one render input key per entry module from the explicit input list.
Nothing uses the keys yet, so the product does not change.

- [ ] Add the bundle environment digest and the per-stylesheet class map
      digests to `JavaScriptGeneration` in
      `crates/mokly-catalogue/src/render_sources.rs`. Compute both in
      `crates/mokly-render/src/bundle.rs` and keep them in the bundle state,
      so that a reused bundle keeps them.
- [ ] Add a render input key builder to `crates/mokly-graph`, with a new key
      kind in `key.rs`. It computes each closure once over the module graph
      and maps a handle to its module by the longest module path before a
      `#`.
- [ ] Write the unit tests first, one per input kind, each asserting the
      exact set of module keys that move. The seven key tests of the item: a
      module edit, a dependency upgrade, a preview edit, a resolution file
      edit, a class map change, a slot provider edit, and a link target
      rename. Also: a renderer edit, a plain stylesheet edit that moves
      nothing, equal inputs under two source roots that give equal keys, an
      installed-input name that matches the working name, and an unknown
      handle that uses the fallback.
- [ ] Add the builder to `### Key Code` in `crates/mokly-graph/README.md`.

## Milestone 4: Keys use the render input keys

Replace the fingerprint in fragment and document keys. After this milestone
an edit re-renders only the affected definitions.

- [ ] Write the failing integration tests first in
      `crates/mokly-render/tests/integration/`, with a real sidecar and the
      fixture of the design table. Each test prepares, applies one edit,
      prepares again, and asserts the exact set of document keys that moved.
      Cover every row of the table.
- [ ] Add a test that the second preparation after a comment edit makes
      sidecar render calls only for the moved views, from the captured pool.
- [ ] Use the per-handle key in `MemoFragments` in
      `crates/mokly-graph/src/fragments.rs`.
- [ ] Replace the fingerprint input in `crates/mokly-graph/src/planning.rs`
      and the field in `crates/mokly-graph/src/delivery_inputs.rs`. Apply
      decision 5 at `crates/mokly-graph/src/graph.rs:270`.
- [ ] Build the keys in `crates/mokly-render/src/graph.rs` and pass them to
      the fragment adapter and the delivery inputs.
- [ ] Update the tests that assert the old behaviour, such as the fragment
      request tests, and keep every other test unchanged.
- [ ] Add the unsupported inputs to the authoring guide and one sentence on
      what an edit re-renders to the serve guide.
- [ ] Update the fingerprint text in `crates/mokly-render/README.md` and the
      key text in `crates/mokly-graph/README.md`.
- [ ] Remove the status lines of `docs/architecture/rust-core.md` and
      `docs/protocol/mokly-watch.md`.

## Milestone 5: Cross-side reuse

Let equal head and base inputs share render cache entries under decision 1.

- [ ] Write a failing test first: a base read of a view that a head read
      cached first does not return the head's closure warnings, and a
      base-only `base-conversion` warning never reaches a later head read.
- [ ] Cache composed documents without closure warnings in
      `crates/mokly-graph/src/session_render.rs`, and add each side's
      closure warnings on its own read.
- [ ] Add an integration test with a base extracted from the same commit: the
      base keys equal the head keys, a base capture after a head render makes
      no sidecar render call, and an entry that differs renders on the base
      sidecar with the base generation.
- [ ] Under decision 2 A, add a test that a base with its own installation
      gets keys that differ from the head's.
- [ ] Remove the status lines of `docs/protocol/mokly-sidecar.md` and
      `docs/protocol/mokly-runtime.md`.

## Milestone 6: Measurement and output check

- [ ] Rebuild the release binary and the packages, then repeat the baseline
      method on this branch on the same machine. Rerun when two runs differ
      by more than ten percent. Save the records under `.context/perf/after-*`.
- [ ] Repeat the two `build` runs around the edit. Compare the index keys and
      the rendered bytes with the baseline outputs. Expected: only the edited
      entry's keys move, and the rendered bytes match the baseline build.
- [ ] Check the acceptance: `serve.background` after the edit renders only
      the moved views, and `review.capture-side` on the unchanged base makes
      about zero `sidecar.render` calls.
- [ ] Smoke-test `npm run dev`: open a screen in the browser, edit its
      module, and check that the page shows the edit and that the served
      index changes only that entry's keys. Save a screenshot under
      `.context/perf/`.
- [ ] Add the after numbers to the baseline table as a second column.

## Milestone 7: Verification, commit, review, and pull request

- [ ] Run the targeted tests: `cargo test -p mokly-graph`,
      `cargo test -p mokly-render`, `cargo test -p mokly-catalogue`, the
      sidecar Node tests, `npm test -- tests/markdown_links.test.ts`, and
      `npm run format:check`.
- [ ] Run `cargo xtask check --suite repository`, then the complete gate
      `cargo xtask check`.
- [ ] Commit with Conventional Commits and push the branch after each
      milestone.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request with the before and after table when every other
      milestone TODO is ticked. Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] Measure again after perf 0 merges. A lighter render cache weight keeps
      more head entries, which raises the cross-side hit rate.
