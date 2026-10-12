# Rust Rebuild

Status: Active. Created 2026-10-12 with the user's consent. It supersedes the
[native engine plan](./native-rust-engine.md), which stays closed as history.
On 2026-10-12 the user decided to freeze the TypeScript backend immediately,
to remove the replaced JavaScript and its tests together instead of
incrementally, to treat the old outputs as guidance rather than an exact
parity target, to keep counting format versions instead of resetting to v1, to
provide no backward compatibility with old output, to reset Mokly Cloud, and to
keep the upload exchange protocol unchanged. Milestones 1 and 2 of this plan
land in one pull request; the follow-on plans listed under Programme carry the
Rust core, one pull request each. No milestone is complete.

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

**Approvals the user gave on 2026-10-12, recorded for the teardown:**

- Deleting content on `origin/main` for the teardown: the paths named in
  Milestone 2. The teardown commit restates them.
- The functioning-product rule is suspended between the teardown and the
  follow-on plan that serves a catalogue again. The viewer package keeps
  working throughout.

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

## Programme

This plan lands the spec and the teardown. The Rust core follows in these
plans, created when their predecessor merges, one pull request each, in this
order: workspace skeleton and native packaging; HTML screens and components
end to end with the catalogue, manifest v11, read model v7, Serve through the
viewer, and export; the sidecar for React, Storybook, the viewer shell, and
live prop editing; Changes with tree comparison, CSS attribution, tracked and
rebuilt baselines, review v8, and snapshot v4; watch and incremental builds;
publish through the unchanged exchange and the first 0.x release; and
large-project acceptance on the large fixture, bookfolio, and the Mokly Cloud
catalogue. Each follow-on plan runs the gap sweep of Milestone 1 for its
subsystem before it closes.

## Milestone 1: Architecture spec and contracts

Documentation only. At completion the new spec set defines the rebuild
without guesswork, and every protocol page is classified.

- [ ] Write `docs/architecture/rust-core.md`: the crate layout, process
      topology (shim, binary, sidecar pool), the build graph and its cache
      keys, the tree-based comparison model, memory bounds, and the format
      inventory with the numbers of Decision 4.
- [ ] Write `docs/protocol/mokly-sidecar.md`: the sidecar lifecycle, the
      newline-delimited JSON requests and responses for component, screen,
      story, and shell renders, the style-collection rule, the fragment cache
      key, cancellation, timeouts, and the fail-closed rules.
- [ ] Write `docs/protocol/mokly-html-screens.md` and
      `docs/protocol/mokly-html-components.md` from the HTML screens plan's
      decisions and the HTML component format above, each with one worked
      example and exact diagnostics.
- [ ] Write `docs/protocol/mokly-comparison.md` and revise
      `mokly-css-attribution.md`: tree materiality, marker-derived ownership,
      the inline style rule for whole-screen entries, Changes membership,
      review result v8, and change snapshot v4.
- [ ] Revise `mokly-catalogue.md`, `mokly-format-versions.md`,
      `mokly-paths.md`, `mokly-folders.md`, `mokly-variants.md`,
      `mokly-moves.md`, and `mokly-documents.md` to the new numbers and the
      tree model; state that no earlier number is readable.
- [ ] Classify every page in `docs/protocol` as keep, rewrite, or delete, with
      one reason each, in `.context/rust-rebuild/protocol-triage.md`; put the
      resulting index in `docs/protocol/README.md`. The upload exchange pages
      and fixtures are keep, unchanged.
- [ ] Write the gap-sweep procedure and the reference-capture procedure into
      `docs/dev/rebuild.md`: which scenarios to capture, the behaviour-table
      script, and the triage bins of Decision 3.
- [ ] Update `README.md`, `docs/dev/documentation.md`, `AGENTS.md` where they
      assume the TypeScript backend, and add the breaking-change note to
      `docs/protocol/npm-release-notes.md`.
- [ ] Validate Prettier, links, protocol sizes, and the documentation tests.
- [ ] Commit.

## Milestone 2: Reference capture and teardown

At completion the tree holds the viewer, the kept specs, the authored example
content, a trimmed `xtask`, and a green reduced gate. No CLI exists until the
follow-on plans restore it.

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
- [ ] Commit and push.
- [ ] Review the complete local diff against `origin/main` using
      `docs/implementation-review-prompt.md`. Report findings with numbers,
      severities, impact, lettered options, and a recommendation, then apply
      the review-fix rule in `docs/dev/review.md`: fix the `Auto-fix: yes`
      findings, re-review once, and report the rest.

## Post-merge follow-up (non-blocking)

- Create the first follow-on plan, the workspace skeleton and native
  packaging, from the Programme section.
- Reset Mokly Cloud and republish its catalogue when the first 0.x release of
  the new core ships.
- Decide on a WebAssembly fallback for platforms without a native package.
