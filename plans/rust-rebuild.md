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
inventory names manifest v11, review v8, read model v7 and snapshot v4, and
every protocol page is classified. The structural test that binds the
catalogue page's format table to the old code fails until the teardown
removes that test.

**Goal:** rebuild Mokly's backend as a Rust core with a Node sidecar for
JavaScript rendering, on a clean tree. The core meets five requirements:
detect changes and affected screens from rendered output and CSS rules, as
today; render screens and components from HTML with YAML front matter without
JavaScript; keep tracked and rebuilt generated output and baselines, as today;
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
4. Formats keep counting: manifest v11, review result v8, public read model
   v7, change snapshot v4. Every reader accepts exactly one number and
   rejects others with an actionable error. Numbers bump freely before 1.0,
   with no reader for the earlier number. Package 1.0.0 is the first stable
   format promise.
5. No backward compatibility with old output: no reader, shim, or migration
   for old manifests, caches, baselines, config shapes, or authoring modules.
   A base commit that only ever built old output makes Changes unavailable
   until the base moves past the switch.
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

**Approvals the user gave on 2026-10-12, recorded for the teardown:**

- Deleting content on `origin/main` for the teardown: the paths named in
  Milestone 2. The teardown commit restates them.
- The functioning-product rule is suspended between the teardown and
  Milestone 6, which serves a catalogue again. The viewer package keeps
  working throughout.
- Pending the user's approval, under the rule that a new gate needs it: the
  Rust advisory audit, the generated-TypeScript byte-identity check, and the
  time and memory budgets of Milestone 14. Milestone 3 records the answer
  before adding any of them.

**Architecture:**

- The `mokly` executable is a Rust binary shipped in `@mokly/native-<target>`
  platform packages, resolved by a small Node shim in `@mokly/mokly`. The
  binary owns discovery, the catalogue model, HTML composition, stylesheets,
  document assembly, a content-addressed build graph with parallel scheduling,
  watch, the server, comparison, export, and publish.
- A pool of Node sidecars renders only JavaScript: a React component with
  props, a React screen, a Storybook story through portable stories, and the
  viewer shell for Serve and export. A sidecar returns an HTML fragment plus
  the styles that render produced. The binary memoizes every fragment by the
  hash of bundle generation, export, props, viewport, and scheme, and caches
  shell HTML by route and catalogue revision.
- Screens and components can be HTML files with YAML front matter. The format
  adopts the decisions of the HTML screens plan on branch
  `calummoore/yaml-vs-html-screens` (front matter keys, custom element names,
  kebab-case attributes coerced through prop schemas, `$name` data references,
  named slots, `mokly-viewport`, variants, `mock:` links, ignore markers, and
  exact diagnostics) and adds HTML components: a front matter block with the
  element name, prop schema, and slots, and a body with attribute and text
  substitution and named slots. No loops or expressions in the first version.
- Comparison works on trees, not text. Component and ignore markers are
  comment nodes; an element's owner is its nearest enclosing marker pair;
  materiality compares canonical trees after removing ignored regions and
  unowned styles. CSS attribution keeps today's rule-level matching and its
  conservative keep list, on the `lightningcss` and `selectors` crates.
  Inline style ownership for sidecar-rendered components comes from the render
  itself, so no inference is needed; whole-screen React entries get one simple
  rule stated in the spec.
- Every shared shape has one definition in a Rust model crate, and the
  TypeScript types are generated from it. Format bumps are one edit.
- Rust conventions follow `docs/dev/rust.md`: trait seams, `dyn` dispatch,
  `unimock`, `thiserror`, `tracing`, 300-line files, `_tests_` directories.

**Non-goals of this plan:** implementing any Rust crate beyond the workspace
skeleton the follow-on plans need; changing the viewer's presentation;
compatibility readers; a pure YAML screen format; loops or expressions in HTML
bodies; pixel comparison.

## Order of work

The milestones run in order on one branch. Milestones 1 and 2 remove the old
backend; Milestones 3 to 6 restore a CLI that serves HTML catalogues;
Milestones 7 to 13 add the sidecar, Changes, watch, export, publish, and
release packaging; Milestone 14 proves scale; Milestone 15 closes the plan.
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
- [ ] Close every active plan that the rebuild supersedes with a Completed
      status paragraph that names this plan.
- [ ] Trim `xtask`: the repository suite keeps the audit, Prettier, ESLint,
      the length audits, Rust formatting, Clippy, tests, and the file-length
      audit; a viewer suite runs the viewer typecheck and tests; the package,
      unit, browser, and hydration suites and their remote shards are removed
      until the follow-on plans add new ones.
- [ ] Update `.github/workflows/ci.yml`, `release-please-config.json`, and
      `.release-please-manifest.json` for the reduced tree; keep the viewer
      release path.
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
components, Markdown documents, pages, flows, and use cases, validates it, and
writes manifest v11 without rendering.

- [ ] Implement roots, default globs, folder records, path identity, variants,
      moves hints, and the diagnostics of the identity contracts in
      `mokly-catalogue`.
- [ ] Implement the front matter parser and the file kinds decided in
      Milestone 1, with exact diagnostics and line and column reporting.
- [ ] Implement manifest v11 in `mokly-model` with canonical JSON, the source
      inventory, and the generated TypeScript types.
- [ ] Behaviour tests from fixtures: one catalogue per identity rule, every
      diagnostic, and the reference catalogue's entry set.
- [ ] Commit.

## Milestone 5: HTML rendering and generated output

At completion `mokly build` and `mokly check` render HTML screens and
components into `mokly-generated/` under the tracked and untracked rules.

- [ ] Implement HTML components in `mokly-html`: prop schemas, scalar coercion,
      `$name` data references, named slots, attribute and text substitution,
      `mokly-viewport`, `mokly-instance`, and the element registry.
- [ ] Implement screen composition: viewports, colour schemes, stylesheet
      rules, document assembly, `mock:` link rewriting, ignore markers, and the
      component and ignore marker comments the comparison relies on.
- [ ] Implement the output transaction: staging, atomic install through
      `mokly-platform`, the tracked and untracked rules, the check command, and
      the public closure policy for referenced assets.
- [ ] Implement stylesheet handling on `lightningcss`: imports, assets, and
      per-root bundles.
- [ ] Port the example catalogue's HTML-only parts and add HTML fixtures; run
      the gap sweep against the rendering and output contracts.
- [ ] Write the HTML authoring guides under `docs/guides`.
- [ ] Commit.

## Milestone 6: Sidecar foundation and Serve

At completion `mokly serve` serves an HTML catalogue through the viewer. The
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
      Rust keyed by bundle generation, export, props, viewport, and scheme.
- [ ] Implement live prop editing in Serve through the same render path.
- [ ] Restore the example catalogue, the design catalogue, and a packed
      consumer smoke; run the gap sweep against the old rendering and
      component contracts.
- [ ] Write the JavaScript authoring guides.
- [ ] Commit.

## Milestone 9: Changes

At completion Serve and the CLI classify changes against the Git base with
tree comparison, CSS attribution, and both baseline kinds.

- [ ] Implement Git evidence in `mokly-git`: merge base, changed paths, and
      bounded blob reads.
- [ ] Implement baselines: tracked output through blobs, and rebuilt output
      through the base's own commands with the cache, locks, extraction
      limits, and process scopes of the storage contract.
- [ ] Implement tree comparison in `mokly-compare`: marker-derived ownership,
      ignore regions, materiality on canonical trees, moves, documents, pages,
      flows, affected consumers, and review result v8.
- [ ] Implement CSS attribution in `mokly-css`: rule collection, diffing,
      selector matching with the keep list, own-page membership, the inline
      rule for whole-screen React entries, and a content-addressed parsed-CSS
      cache.
- [ ] Implement background classification in Serve, the change snapshot v4,
      and on-demand comparison snapshots and panes.
- [ ] Behaviour tests from the captured scenarios, rewritten in the new
      formats; run the gap sweep against the Changes, attribution, and
      baseline contracts.
- [ ] Commit.

## Milestone 10: Viewer reads review v8 and snapshot v4

Tags: ui

- [ ] Update the viewer's review and snapshot readers to the generated types;
      comparison panes and Changes presentation do not change.
- [ ] Run the viewer suite against Milestone 9 output.
- [ ] Commit.

## Milestone 11: Watch and incremental builds

- [ ] Implement the content-addressed build graph: inputs hashed per entry,
      invalidation from the sidecar's module graph, HTML component
      dependencies, stylesheet dependencies, and PostCSS reports.
- [ ] Implement the watcher with the denial rules, rebuild on change, bundle
      replay for HTML-only edits, and live updates to the viewer.
- [ ] Behaviour tests that count rebuilds and renders per change.
- [ ] Commit.

## Milestone 12: Export and publish

- [ ] Implement export in `mokly-export`: the complete static catalogue,
      delivery descriptors, the ownership marker, and the transaction with
      backup, exclusive rename, and rollback.
- [ ] Implement publish through the unchanged exchange v1: plan, blobs,
      complete, retries, accounting, the clean-checkout and uncommitted
      changes rules, and the upload validation fixtures.
- [ ] Restore the preview deployment workflow on the new CLI.
- [ ] Write the export and publish guides.
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
      four-scenario benchmark harness; record the time and memory budgets in
      the timings contract once approved.
- [ ] Run the fixture, the bookfolio catalogue, and the Mokly Cloud catalogue
      through build, serve, Changes, watch, and export; save the evidence
      under `.context/rust-rebuild/`.
- [ ] Complete the gap sweep: every triage decision is in a spec or recorded
      as an accepted difference for the release note.
- [ ] Commit.

## Milestone 15: Verification, close-out, and review

- [ ] Run `cargo xtask check`; fix anything it reports until it passes.
- [ ] Commit and push.
- [ ] Review the complete local diff against `origin/main` using
      `docs/implementation-review-prompt.md`. Report findings with numbers,
      severities, impact, lettered options, and a recommendation, then apply
      the review-fix rule in `docs/dev/review.md`: fix the `Auto-fix: yes`
      findings, re-review once, and report the rest.

## Post-merge follow-up (non-blocking)

- Publish the first 0.x release of the new core: platform packages, viewer,
  then CLI; verify each registry package.
- Reset Mokly Cloud and republish its catalogue with the released CLI.
- Decide on a WebAssembly fallback for platforms without a native package.
