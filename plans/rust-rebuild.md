# Rust Rebuild

Status: Active. Created 2026-10-12 with the user's consent. It supersedes the
[native engine plan](./native-rust-engine.md), which stays closed as history.
On 2026-10-12 the user decided to freeze the TypeScript backend immediately,
to remove the replaced JavaScript and its tests together instead of
incrementally, to treat the old outputs as guidance rather than an exact
parity target, to keep counting format versions instead of resetting to v1, to
provide no backward compatibility with old output, to reset Mokly Cloud, and to
keep the upload exchange protocol unchanged. The user also decided that
everything needed for the new version lands in this one plan and one pull
request, and overrode, for this pull request only, the plan rules that bind
one plan to one pull request and that require a functioning product after
every milestone: the branch has no CLI between Milestone 2 and Milestone 6.
Milestone 1 is complete: the Rust core architecture, the sidecar, HTML
screens, HTML components, and comparison contracts exist, the format
inventory names review v8, read model v7 and snapshot v4, and
every protocol page is classified. The structural test that binds the
catalogue page's format table to the old code fails until the teardown
removes that test. On 2026-10-12 the branch was rebased onto the
`AGENTS.md` that names the shared skills, and the rebuild procedures moved
from the removed `docs/dev` directory to
[the protocol page](../docs/protocol/rust-rebuild-procedures.md). Later that day
the user withdrew the committed generated tree: both comparison sides render
from sources, the static output is a plain output, and the Milestone 1 contracts were
revised to match (Decisions 11 to 13). The protocol index then moved eight
generated-tree and baseline pages to retired and the CSS attribution and
Markdown documents pages to rewritten; it lists 72 kept, 75 rewritten, and 21
retired pages beside the five new contracts. On 2026-10-13 the user chose the
two verbs `serve` and `build`, caches outside the repository, the enclosing
scope state in render requests, the sidecar's `describe` call, and frozen
wording for the last retired-page targets (Decisions 14 to 16), then the
definition handle and component entries for Storybook stories (Decisions 17
and 18).

**Goal:** rebuild Mokly's backend as a Rust core with a Node sidecar for
JavaScript rendering, on a clean tree. The core meets five requirements:
detect changes and affected screens from rendered output and CSS rules, as
today; render screens and components from HTML with YAML front matter without
JavaScript; render every view in memory from the sources of either commit,
with no generated tree;
render components, screens, and stories from JavaScript, React, and Storybook;
and work well with catalogues of thousands of screens. The viewer package stays
and reads the new formats.

**Problem:** in under three months the backend reached 53,000 lines of
TypeScript, 173,000 lines of tests, 169 protocol documents, and 62 plans. Most
of that weight comes from doing the work in JavaScript: string materials, text
offsets, memory tricks, worker and IPC layers, an FFI bridge, and the residue
of six manifest versions and two output modes. Measured on the large fixture
on 2026-10-05, React rendering took 54 to 67 percent of every compile, and the
comparison phase ran out of memory in both Serve and Export. The raw spans and
phase table are under `.context/native-rust-engine/measurements-2026-10-05.md`.
Carrying that code into a Rust engine and a new HTML rendering model costs
more than re-deriving the behaviour from the requirements.

**Decisions (user, 2026-10-12):**

1. Freeze the TypeScript backend now. No new product behaviour lands in `src/`
   or its contracts. Bug fixes Mokly Cloud needs before the switch are the
   only exception, released as patch versions from the `ts-backend-final` tag.
2. Remove the replaced JavaScript and its tests together, in one teardown
   change, after tagging the last commit and capturing reference outputs.
3. Parity with the old backend is guidance only. The reference outputs and
   the old contracts are a checklist for cases the new spec missed or left
   undefined, not an oracle. Differences are triaged as improvement, spec gap,
   or regression, and the decision is written into the spec.
4. Formats keep counting: review result v8, public read model v7, change
   snapshot v4; no generated manifest exists (Decision 11). Every reader accepts exactly one number and
   rejects others with an actionable error. Numbers bump freely before 1.0,
   with no reader for the earlier number. Package 1.0.0 is the first stable
   format promise.
5. No backward compatibility with old output: no reader, shim, or migration
   for old manifests, caches, baselines, config shapes, or authoring modules.
   A base commit renders from its sources, so Changes works across the
   switch; a base whose sources fail current validation makes Changes
   unavailable with those diagnostics (Decision 11).
6. Mokly Cloud is reset and republished; its viewer and receiver update in the
   same window as the first release of the new core.
7. The upload exchange (plan, blob, complete; v1) and its validation rules do
   not change. They carry bytes and digests and never interpret the catalogue.
8. The first release of the new core is a 0.x minor version with a
   breaking-change release note.
9. HTML screens and components carry their front matter in a leading `---`
   block with the same delimiter rule as Markdown documents. No comment form
   is accepted, so there is one way to write it. Mokly's own attributes keep
   their short names, `mokly-viewport` and `mokly-instance`; strict HTML
   validity is not a goal of the format.
10. The sidecar bundles consumer JavaScript and reports the module graph;
    Rust owns invalidation and caching. Milestone 1 chooses between esbuild
    and Rolldown for that bundling and records why.
11. No committed generated tree (2026-10-12). Both sides of a comparison
    render from sources: the head from the working tree, the base from the
    base commit's Git tree, through one render graph and a bounded render
    cache; both sides use the current Mokly version. No command writes into
    the repository. The static output of `build` is a plain output that
    nothing reads back, and `publish` uploads it. This withdraws the earlier requirement to keep
    tracked and rebuilt output.
12. React and Storybook components, React screens, the renderer module, and
    consumer PostCSS at the base follow three dependency tiers (2026-10-12,
    widened 2026-10-13): an identical lockfile uses the working tree's
    dependencies; a different lockfile installs the base's dependencies into
    a bounded content-addressed cache with lifecycle scripts disabled under a
    time limit; an impossible install uses the working tree's dependencies
    with a warning.
13. Markers (2026-10-12): the core attaches ownership and ignore regions to
    tree nodes; comment markers exist only in the fragments a sidecar
    returns; ignore scopes resolve at render time; the `mokly-` prefix is
    reserved for element names in authored HTML and for comment names in
    fragments. A changed style rule that matches no element produces no
    evidence record.
14. Two verbs (2026-10-13): `serve` and `build`. `build` validates the
    catalogue, renders every view, fails on errors and, with `--strict`, on
    warnings, and writes the static output into the directory `--out` names,
    `mokly-static/` at the repository root by default, which Git must ignore.
    `publish` builds into its own directory outside the repository and
    uploads. There is no `check`
    and no `export`; a validation-only run is a build to a temporary
    directory.
15. Caches (2026-10-13): the render cache is process memory. The base-side
    extraction cache and the dependency install cache live outside the
    repository, in the operating system's cache directory under a key derived
    from the repository path, bounded by bytes and evicted least recently
    used; the terminal names the directory, and deleting it is safe. No
    command writes into the repository except `build` into its output
    directory.
16. Scope state (2026-10-13): the core sends the enclosing ignore scope state
    with each component render, the sidecar seeds its React scope context
    from it, the fragment cache key includes it, each slot placeholder reports
    the state at its position, which the core applies as the innermost scope
    of the slot content, and the core applies no outer scope to a fragment.
17. Handles (2026-10-13): `describe` returns every definition with a handle,
    the file path plus the export name, and a screen variant adds its slug
    after a slash; `renderScreen` and `renderComponent` name a definition by
    its handle, and the fragment key holds the handle or the story id.
18. Stories (2026-10-13): a stories file becomes one component entry at the
    path derived from the file, and each story becomes a variant of it with
    its `args` as props; `argTypes` supply the schema and controls when
    present. The read model and the viewer need no story kind.

**Approvals the user gave on 2026-10-12, recorded for the teardown:**

- Deleting content on `origin/main` for the teardown: the paths named in
  Milestone 2. The teardown commit restates them.
- The functioning-product rule is suspended between the teardown and the end
  of Milestone 7, when the viewer reads the served catalogue again, and from
  the end of every milestone that emits a new format until the end of the
  milestone in which the viewer reads it; today that is Milestones 9 to 10.
  The viewer package keeps working throughout.
- Pending the user's approval, under the rule that a new gate needs it: the
  Rust advisory audit, the generated-TypeScript byte-identity check, and the
  time and memory budgets of Milestone 14. Milestone 3 records the answer
  before adding any of them.

**Review decisions the user gave on 2026-10-12:** every live native engine
reference is repointed now; head styles, owned and unowned, leave the canonical
form; the behaviour-table script is written on this branch; the server
milestones serve the new formats and the viewer reads them in the milestone
that follows; `defineComponent` gains `element`; sidecar recycling thresholds
are fixed; the protocol triage stays under `.context/`; the documentation
policy page is kept; the four remaining format owners carry Delivery Status
pointers; the pull request description writes `{target}` for the placeholder.
Later that day the user chose render-time scope resolution with comment
markers only in sidecar fragments, the suspension principle for every
new-format gap, no evidence record for a rule that matches nothing, and the
one-word version repair on the component review page. On 2026-10-13 the user
also chose the sidecar's `describe` call as the source of JavaScript component
definitions and frozen wording for the two remaining retired-page targets, then
widened `describe` to every definition kind and the story inventory, fixed
the `ignoreScope` values as `enabled` and `disabled`, chose the definition
handle for render requests, and made Storybook stories component variants.

**Architecture:**

- The `mokly` executable is a Rust binary shipped in `@mokly/native-<target>`
  platform packages, resolved by a small Node shim in `@mokly/mokly`. The
  binary owns discovery, the catalogue model, HTML composition, stylesheets,
  document assembly, a content-addressed render graph with parallel scheduling,
  watch, the server, comparison, the static build, and publish. No command
  writes into the repository; `build` writes its output directory.
- A pool of Node sidecars renders only JavaScript: a React component with
  props, a React screen, a Storybook story through portable stories, and the
  viewer shell for Serve and `build`. A sidecar returns an HTML fragment plus
  the styles that render produced. The binary memoizes every fragment by the
  hash of bundle generation, handle, props, viewport, scheme, and enclosing
  ignore scope, and caches
  shell HTML by route and catalogue revision.
- Screens and components can be HTML files with YAML front matter. The format
  adopts the decisions of the HTML screens plan on branch
  `calummoore/yaml-vs-html-screens` (front matter keys, custom element names,
  kebab-case attributes coerced through prop schemas, `$name` data references,
  named slots, `mokly-viewport`, variants, `mock:` links, ignore markers, and
  exact diagnostics) and adds HTML components: a front matter block with the
  element name, prop schema, and slots, and a body with attribute and text
  substitution and named slots. No loops or expressions in the first version.
- Comparison works on trees, not text. Both sides render from sources with
  the current version, the base from its Git tree under the dependency tiers
  of Decision 12. Ownership and ignore regions are node annotations, carried
  as comment markers only in sidecar fragments; an element's owner is its
  nearest enclosing region;
  materiality compares canonical trees after removing ignored regions and
  head styles, owned and unowned; styles count through rule evidence only.
  CSS attribution keeps today's rule-level matching and its
  conservative keep list, on the `lightningcss` and `selectors` crates.
  Inline style ownership for sidecar-rendered components comes from the render
  itself, so no inference is needed; whole-screen React entries get one simple
  rule stated in the spec.
- Every shared shape has one definition in a Rust model crate, and the
  TypeScript types are generated from it. Format bumps are one edit.
- Rust conventions follow the shared `rust` skill that `AGENTS.md` names:
  trait seams, `dyn` dispatch,
  `unimock`, `thiserror`, `tracing`, 300-line files, `_tests_` directories.

**Non-goals of this plan:** changing the viewer's presentation;
compatibility readers; a pure YAML screen format; loops or expressions in HTML
bodies; pixel comparison.

## Order of work

The milestones run in order on one branch. Milestones 1 and 2 remove the old
backend; Milestones 3 to 6 restore a CLI that serves HTML catalogues;
Milestones 7 to 13 add the sidecar, Changes, watch, the static build, publish,
and release packaging; Milestone 14 proves scale; Milestone 15 closes the plan.
Each milestone runs the gap sweep of Milestone 1 for its subsystem before it
closes. Milestones tagged `ui` change only the viewer package.

## Milestone 1: Architecture spec and contracts

Documentation only. At completion the new spec set defines the rebuild
without guesswork, and every protocol page is classified.

- [x] Write `docs/architecture/rust-core.md`: the crate layout, process
      topology (shim, binary, sidecar pool), the build graph and its cache
      keys, the tree-based comparison model, memory bounds, and the format
      inventory with the numbers of Decision 4.
- [x] Write `docs/protocol/mokly-sidecar.md`: the sidecar lifecycle, the
      newline-delimited JSON requests and responses for component, screen,
      story, and shell renders, the style-collection rule, the fragment cache
      key, cancellation, timeouts, and the fail-closed rules.
- [x] Write `docs/protocol/mokly-html-screens.md` and
      `docs/protocol/mokly-html-components.md` from the HTML screens plan's
      decisions and the HTML component format above, each with one worked
      example and exact diagnostics, with the `---` front matter rule of
      Decision 9, and with the file kinds for pages, flows, and use cases
      that need no JavaScript (YAML or HTML files, decided here).
- [x] Decide and record the sidecar bundler (Decision 10), the consumer
      PostCSS worker, the React style-collection rule, and the Storybook
      portable-stories entry.
- [x] Write `docs/protocol/mokly-comparison.md` and revise
      `mokly-css-attribution.md`: tree materiality, marker-derived ownership,
      the inline style rule for whole-screen entries, Changes membership,
      review result v8, and change snapshot v4.
- [x] Revise `mokly-catalogue.md`, `mokly-format-versions.md`,
      `mokly-paths.md`, `mokly-folders.md`, `mokly-variants.md`,
      `mokly-moves.md`, and `mokly-documents.md` to the new numbers and the
      tree model; state that no earlier number is readable.
- [x] Classify every page in `docs/protocol` as keep, rewrite, or delete, with
      one reason each, in `.context/rust-rebuild/protocol-triage.md`; put the
      resulting index in `docs/protocol/README.md`. The upload exchange pages
      and fixtures are keep, unchanged.
- [x] Write the gap-sweep procedure and the reference-capture procedure into
      `docs/dev/rebuild.md`: which scenarios to capture, the behaviour-table
      script, and the triage bins of Decision 3.
- [x] Update `README.md`, `docs/dev/documentation.md`, `AGENTS.md` where they
      assume the TypeScript backend, and add the breaking-change note to
      `docs/protocol/npm-release-notes.md`.
- [x] Validate Prettier, links, protocol sizes, and the documentation tests.
- [x] Commit.

Outcomes recorded in the contracts: the screen suffix is `.screen.html`
(not `.mockup.html`) so HTML screens, components and pages share one naming
rule; pages are `.page.html` and use cases `.use-case.yaml`; the sidecar
bundles with esbuild because the frozen backend's plugin behaviour ports
directly and its metafile is the module inventory, with Rolldown reviewed
after the first release; the bundle generation is the fragment cache key; and
styles are collected per render. The protocol triage is
`.context/rust-rebuild/protocol-triage.md`: 77 pages kept, 81 rewritten by
their owning milestones, 14 retired at the teardown.

## Milestone 2: Reference capture and teardown

At completion the branch holds the viewer, the kept specs, the authored
example content, a trimmed `xtask`, and a green reduced gate. No CLI exists
until Milestone 6. `main` keeps the old backend until this pull request
merges; the freeze applies to it from 2026-10-12.

- [ ] Confirm the landable pull requests merged: #135, #182, and the test and
      CI housekeeping; the user merges them.
- [ ] Tag the last TypeScript backend commit on `main` as `ts-backend-final`.
- [ ] Write `scripts/rebuild/behaviour-table.mjs` on this branch: it reduces one
      captured scenario to the JSON table that the rebuild procedures define.
- [ ] Capture reference outputs with the old CLI under
      `.context/rust-rebuild/reference/`: the example catalogue, the large
      fixture's four scenarios, and the moved, removed, Markdown document,
      ignore-region, and renderer-change states; run the behaviour-table
      script over them.
- [ ] Delete, with the recorded approval: `src/`; the backend tests under
      `tests/` except the documentation, guide, and workflow policy tests that
      still apply; `scripts/package`, `scripts/preview`, `scripts/large`, and
      the verification runners that drive the old CLI; the protocol pages
      classified delete; the superseded plans, which git history keeps; the
      preview deployment workflow; and the root package's `bin`, `exports`,
      `files`, and publish configuration.
- [x] Repoint or remove every live reference to the native engine contract
      before the teardown deletes `docs/protocol/mokly-native-engine.md`.
- [ ] Close every active plan that the rebuild supersedes with a Completed
      status paragraph that names this plan.
- [ ] Trim `xtask`: the repository suite keeps the audit, Prettier, ESLint,
      the length audits, Rust formatting, Clippy, tests, and the file-length
      audit; a viewer suite runs the viewer typecheck and tests; the package,
      unit, browser, and hydration suites and their remote shards are removed
      until later milestones add new ones.
- [ ] Update `.github/workflows/ci.yml`, `release-please-config.json`, and
      `.release-please-manifest.json` for the reduced tree; keep the viewer
      release path.
- [ ] Update `AGENTS.md` for the reduced tree: the commands, the repository
      rules, and the moment to read the `rust` skill, which then covers
      `crates/` as well as `xtask/`.
- [ ] Run `cargo xtask check` on the reduced tree until it passes.
- [ ] Record the deleted top-level paths in the commit body.
- [ ] Commit.

## Milestone 3: Workspace skeleton and native packaging

At completion the Rust workspace builds, the `mokly` binary runs `--help` and
`--version`, and the platform packages, shim, and CI build steps exist.

- [ ] Add the crates: `mokly-model` (shared shapes, canonical JSON, generated
      TypeScript), `mokly-cli` (the binary, clap grammar, terminal output),
      `mokly-platform` (exclusive rename, process groups, Windows job objects),
      `mokly-git` (command runner, bounded batches), and `mokly-sidecar` (the
      client of the sidecar protocol). Later milestones add their own crates.
      Each crate has a README with the required sections.
- [ ] Add the five `@mokly/native-<target>` workspace packages, the shim in
      `@mokly/mokly` that resolves the binary and checks versions, and the
      `cargo xtask build-native` and `generate-types` commands; `npm run build`
      builds the host target.
- [ ] Extend `xtask check`: Rust formatting, Clippy, tests, file length, the
      generated-type byte-identity check and the Rust advisory audit once
      approved, and the viewer suite. CI builds the native artifacts in every
      job and on the Testbox through `rust-toolchain.toml`.
- [ ] Record the gate approvals from the Status section before adding the gates.
- [ ] Commit.

## Milestone 4: Catalogue model and discovery

At completion `mokly build` discovers a catalogue of HTML screens, HTML
components, Markdown documents, pages, and use cases, validates it, builds the
catalogue model, and reports diagnostics; rendering and output follow in later
milestones.

- [ ] Implement roots, default globs, folder records, path identity, variants,
      moves hints, and the diagnostics of the identity contracts in
      `mokly-catalogue`.
- [ ] Implement the front matter parser and the file kinds decided in
      Milestone 1, with exact diagnostics and line and column reporting.
- [ ] Implement the catalogue model in `mokly-model` with canonical JSON and
      the generated TypeScript types; it lives in memory, with no file on
      disk.
- [ ] Behaviour tests from fixtures: one catalogue per identity rule, every
      diagnostic, and the reference catalogue's entry set.
- [ ] Commit.

## Milestone 5: HTML rendering and the render cache

At completion `mokly build` validates, renders HTML screens and components
into the bounded render cache, and reports diagnostics; it writes its output
from Milestone 12.

- [ ] Implement HTML components in `mokly-html`: prop schemas, scalar coercion,
      `$name` data references, named slots, attribute and text substitution,
      `mokly-viewport`, `mokly-instance`, and the component registry with the
      reserved `mokly-` prefix.
- [ ] Implement screen composition: viewports, colour schemes, stylesheet
      rules, document assembly, `mock:` link rewriting, ignore regions with
      their scopes resolved, and the ownership annotations the comparison
      relies on.
- [ ] Implement the render cache: content keys, the byte bound, eviction, and
      the source tree trait over the working tree and Git trees; the `build`
      validation run with `--strict`; and the closure of referenced assets for Serve and the
      static output.
- [ ] Implement stylesheet handling on `lightningcss`: imports, assets, and
      per-root bundles.
- [ ] Port the example catalogue's HTML-only parts and add HTML fixtures; run
      the gap sweep against the rendering contracts.
- [ ] Write the HTML authoring guides under `docs/guides`.
- [ ] Commit.

## Milestone 6: Sidecar foundation and Serve

At completion `mokly serve` serves an HTML catalogue as read model v7 over
HTTP with the shell routes; the viewer renders it after Milestone 7. The
sidecar exists only to render the viewer shell.

- [ ] Implement the sidecar protocol in `@mokly/mokly` and `mokly-sidecar`:
      process pool, newline-delimited JSON, cancellation, timeouts, fail-closed
      rules, and the shell render with its per-route cache.
- [ ] Implement the server in `mokly-server`: static delivery, the public read
      model v7, shell routes, live update streams, shutdown ordering, and the
      terminal output contract in the CLI.
- [ ] Behaviour tests: every route shape, delivery descriptors, and shutdown.
- [ ] Commit.

## Milestone 7: Viewer reads read model v7

Tags: ui

- [ ] Update the viewer's data readers and validators to the generated read
      model v7 types; no presentation change.
- [ ] Run the viewer suite and the hydration routes against the Milestone 6
      server.
- [ ] Commit.

## Milestone 8: Sidecar rendering for JavaScript

At completion React components, React screens, and Storybook stories render
through the sidecar, and the example catalogue renders again.

- [ ] Implement consumer bundling in the sidecar with the bundler of Decision
      10, the module graph report, the consumer renderer module, React
      resolution from the consumer, and the optional consumer PostCSS worker.
- [ ] Implement component, screen, and story renders that return a fragment
      plus the styles the render produced; implement the fragment cache in
      Rust keyed by bundle generation, handle, props, viewport, scheme, and
      the enclosing ignore scope; slot placeholders report their scope state;
      a stories file is a component entry whose stories are its variants.
- [ ] Implement `describe`: every definition the entry modules and stories
      files export, with the story inventory; feed every definition into the
      catalogue model, and register JavaScript components by `element` with
      the uniqueness rule, the reserved `mokly-` prefix, and the reserved-prop
      failure of the components contract.
- [ ] Implement live prop editing in Serve through the same render path.
- [ ] Restore the example catalogue, the design catalogue, and a packed
      consumer smoke; run the gap sweep against the old rendering and
      component contracts.
- [ ] Write the JavaScript authoring guides.
- [ ] Commit.

## Milestone 9: Changes

At completion Serve and the CLI classify changes against the Git base with
tree comparison, CSS attribution, and base-side rendering from Git. Serve emits review
v8 and snapshot v4; the viewer renders them after Milestone 10.

- [ ] Implement Git access in `mokly-git`: merge base, changed paths, bounded
      blob and tree reads, and archive extraction of a commit.
- [ ] Implement base-side rendering: the base commit's Git tree as a source
      tree through the render graph, on-demand extraction of the base commit into
      a cache keyed by commit, the three dependency tiers of Decision 12 with
      the bounded install cache, scripts disabled, the time limit, the
      `base-dependencies` warning, and the terminal line that names the cache
      directory.
- [ ] Implement tree comparison in `mokly-compare`: ownership regions attached
      at composition,
      ignore regions, materiality on canonical trees, moves, documents, pages,
      affected consumers, and review result v8.
- [ ] Implement CSS attribution in `mokly-css`: rule collection, diffing,
      selector matching with the keep list, own-page membership, the inline
      rule for whole-screen React entries, and a content-addressed parsed-CSS
      cache.
- [ ] Implement background classification in Serve, the change snapshot v4,
      and on-demand comparison snapshots and panes.
- [ ] Behaviour tests from the captured scenarios, rewritten in the new
      formats; run the gap sweep against the Changes and attribution
      contracts.
- [ ] Commit.

## Milestone 10: Viewer reads review v8 and snapshot v4

Tags: ui

- [ ] Update the viewer's review and snapshot readers to the generated types;
      comparison panes and Changes presentation do not change.
- [ ] Run the viewer suite against Milestone 9 output.
- [ ] Commit.

## Milestone 11: Watch and incremental rendering

- [ ] Implement the content-addressed render graph: inputs hashed per entry,
      invalidation from the sidecar's module graph, HTML component
      dependencies, stylesheet dependencies, and PostCSS reports.
- [ ] Implement the watcher with the denial rules, rebuild on change, bundle
      replay for HTML-only edits, and live updates to the viewer.
- [ ] Behaviour tests that count rebuilds and renders per change.
- [ ] Commit.

## Milestone 12: Static build and publish

- [ ] Implement the static output of `mokly build` in `mokly-static`: the
      complete static catalogue with the shell pages, delivery descriptors,
      the ownership marker, the `--out` option with its default `mokly-static/`
      output directory, and
      the transaction with backup, exclusive rename, and rollback.
- [ ] Implement publish, which builds into its own directory first, through
      the unchanged exchange v1: plan, blobs,
      complete, retries, accounting, the clean-checkout and uncommitted
      changes rules, and the upload validation fixtures.
- [ ] Restore the preview deployment workflow on the new CLI.
- [ ] Write the build and publish guides.
- [ ] Commit.

## Milestone 13: Release packaging

- [ ] Add the release build matrix for the five targets, the package set
      (viewer, five platform packages, CLI), the registry guards, and the
      publish order.
- [ ] Update Release Please for the package set and write the breaking-change
      release note for the first 0.x release of the new core.
- [ ] Dry-run the release scripts locally; the real publication is post-merge.
- [ ] Commit.

## Milestone 14: Large-project acceptance

- [ ] Port the large fixture generator with HTML and React variants and the
      four-scenario benchmark harness; record the time and memory budgets, the
      dependency install time limit, and the render and install cache bounds
      in the timings contract once approved.
- [ ] Run the fixture, the bookfolio catalogue, and the Mokly Cloud catalogue
      through build, serve, Changes, and watch; save the evidence
      under `.context/rust-rebuild/`.
- [ ] Complete the gap sweep: every triage decision is in a spec or recorded
      as an accepted difference for the release note.
- [ ] Commit.

## Milestone 15: Verification, close-out, and review

- [ ] Run `cargo xtask check`; fix anything it reports until it passes.
- [ ] Commit and push.
- [ ] Open the pull request. Its description and squash body write `{target}`
      for the package placeholder, justify each merge decision with its paths,
      and record every approved removal.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - Open from the review of commit 2a068ff5, report under
    `.context/rust-rebuild/review-2026-10-13-handles.md`:
  - 1: story `args` as variant props contradict the closed-schema and
    plain-data rules of the props contract; define the schema inference
    and the `argTypes` mapping.
  - 2: a story variant's title and the other required entry fields are
    undefined.
  - 3: the handle is ambiguous for an array export that holds more than one
    definition.
  - Observation: the sidecar has no render method for a `definePage` page.

## Post-merge follow-up (non-blocking)

- Publish the first 0.x release of the new core: platform packages, viewer,
  then CLI; verify each registry package.
- Reset Mokly Cloud and republish its catalogue with the released CLI.
- Decide on a WebAssembly fallback for platforms without a native package.
