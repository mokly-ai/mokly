# Skip Equal Before Snapshots

Status: Active. On branch `conductor/dedup-4-skip-equal-before-snapshots`, no
pull request yet. The plan closes when its PR merges.

A build with Changes writes one comparison generation under
`mokly-viewer/diffs/generations/{generation}/`. It holds a before copy and an
after copy of every rendered document, generated stylesheet, generated asset,
and authored public file, under `snapshots/before/` and `snapshots/after/`.
Most views of a pull request do not change, so most before files repeat the
after file at the same path. On `main` at `a9dd1e81`, measured on 2026-10-27
with the base equal to `HEAD`, the example catalogue wrote 631 files on each
side, and all 631 pairs had equal bytes. The before side was a 9,204,494-byte
copy: 9,115,769 bytes of documents (99.0%) and 88,725 bytes of 41 resources.
The rule of this plan removes 580 view documents, 98.4% of that before side.
In the browser comparison fixture, which has real changes, it removes 68 view
documents, 24.3% of the before side. `mokly publish` sends each digest once,
so the cost is local disk, build memory, Serve store capacity, and output size.

User decision (2026-10-27): option A of the content duplication investigation
in the workspace "Hash-Based Content Caching". Write a before file only when
its bytes differ from the after file at the same path. When the before file is
absent, the viewer reads the after file. The brief names only this option, so
no rejected alternative is recorded. This plan is "dedup 4" of four changes.
Dedup 1 stops `deploymentId` from changing every entry detail, dedup 2
compresses blob uploads, and dedup 3 keeps a component's usage list only in
its parent detail.

This plan covers the static build, the selected generations of Serve, one new
entry detail marker, the viewer's pane loading, the protocol docs, and a
Mokly Cloud handoff. The shell's screens and copy do not change, so the plan
has no mockup or UI milestone. Before resources follow decision 1. Two other
copies need a separate branch: after-side resources that repeat the current
`static/` files, 88,725 bytes in the example, and the page and Markdown
document snapshots of current entries, which no host reads. Whether Mokly
Cloud keeps blobs between publications is not covered.

Evidence: `.context/skip-equal-before-snapshots/measurements.md`.

## Open Decisions

The user received these decisions on 2026-10-27. Each line gives the
recommended option, which the milestones follow. The message to the user holds
the full options. No milestone starts before the answers.

1. Before resources, High. Recommended: A, keep every before resource and
   skip only shared documents. B also skips resources that only fully equal
   views reach. C rewrites resource URLs in the build or in the viewer.
2. Receiver rule for Mokly Cloud, High. Recommended: A, state that a receiver
   does not require a snapshot document for each view, and hand the rule to
   the Mokly Cloud workspace. B relies on its open decision 6 alone.
3. Version guard, Medium. Recommended: A, guard with an unreleased index
   number, v8 today, and keep the marker an additive detail field. B raises
   the entry detail number. C adds no number.
4. Reader checks of the marker, Low. Recommended: A, both detail readers
   reject a misplaced marker. B accepts it anywhere.

Contract owners:

- [Comparison serving](../docs/protocol/mokly-comparison-serving.md),
  [selected comparisons](../docs/protocol/mokly-selected-comparisons.md),
  [static delivery](../docs/protocol/mokly-export-delivery.md), and
  [Changes serving](../docs/protocol/mokly-changes-serving.md).
- [Artifact paths](../docs/protocol/mokly-artifact-paths.md) and
  [comparison panes](../docs/protocol/mokly-comparison-panes.md).
- [Shell delivery](../docs/protocol/mokly-shell-delivery.md),
  [serialization](../docs/protocol/mokly-catalogue-serialization.md),
  [format versions](../docs/protocol/mokly-format-versions.md), and
  [upload validation](../docs/protocol/mokly-upload-validation.md).
- The crate and viewer READMEs that Milestones 3 and 4 name.

## Design

### Shared Documents

A view has a shared document when all of these hold:

- The view belongs to a current screen or component.
- The entry's base side has the same path, so `before.path` equals the path.
- The view exists on both sides.
- The before and after documents have the same bytes.

The generation stores a shared document once, at its after address, and the
entry detail marks the view with `sameDocument: true`. Every other before
document stays: removed, moved, and case-renamed entries, pages, Markdown
documents, and views whose bytes differ. An added view has no before pane.
Removed previews and removed component comparisons do not change.

Only screen and component views have comparison panes and a per-view detail
record. Page and Markdown before documents were 56,835 bytes in the example,
0.6% of the before side. The rule pairs the two sides of one view, so removed
records and the removed preview metadata need no marker. A moved entry keeps
its before copy even when another entry's equal document sits at its
previous path. That case is rare.

The viewer presents each pane as `srcdoc` with a `<base href>` at the pane's
snapshot address, so the browser loads stylesheets, assets, and authored
files from that side's directory. Neither the viewer nor a static host can
redirect those requests. Under decision 1 option A, every before resource
stays, so a shared view's before pane still shows the old styles of a
stylesheet-only change. The browser comparison fixture has 16 such views.

### Classification And Details

`DocumentComparison` in `crates/mokly-compare/src/comparison_types.rs` gains
`same_document`. `comparison_views::collect` sets it when the view has a
viewport, both routes exist and are equal, and both artifacts have equal
bytes. The function already holds both artifacts, so the check adds no render.
`projection_detail::apply_evidence`, which Serve and `build` share, copies the
flag into the current detail's view as `same_document: Option<True>`.

The classification reads `comparison_document(route)`, and the writers store
`render(route)`. A capture answers `render` with `comparison_document`, and
Serve's head reads through the render cache. A test pins that the two reads
return equal bytes, so the flag describes the stored bytes.

### Static Build And Serve

`comparison_output::append` collects the before routes of shared views from
`result.entries`, and `comparison_files::side` skips those documents on the
before side. Resources, removed details, and previews do not change. The
generation id keeps its algorithm and hashes only the stored files and the
removed details. One comparison still gives one id in every build.

Selected generations use the same layout and count against the store bounds.
`SnapshotCapture::capture` skips the before document of a shared view. It
still captures that document's before closure, because the before pane
resolves its resources on the before side. Serve takes the flag from the
classification and not from the captured bytes, so the files and the details
agree. A renderer whose second render differs can make the before pane show
that render, but such a renderer already shows false differences today. The
classification generation restores only removed entries' documents, so it
does not change.

### Viewer

`readViewComparison` in `packages/viewer/src/catalogue/detail_comparison.ts`
reads the optional marker under decision 4, and `ReviewView` and
`publicComparedEntry` carry it. `selectedComparisonViews` keeps each pane's own
address and gives the before pane of a shared view the after address as its
source. The comparison documents and the snapshot loader carry the source
beside the address. The loader confines both to the generation, fetches the
source, and checks the final URL against it. It presents the body with the
pane's own address as the document address and fallback base, which
`data-mokly-preview-source` keeps. One fetch per source serves both panes of a
shared view. Removed previews read only before addresses.

### Unmodified Views That Stay Eligible

`screens/consumer` in the browser comparison fixture shows Unmodified and stays
eligible through the changed `components/card`. Its documents are equal, but
`theme.css` differs. Its before pane reads the after document and resolves
`theme.css` on the before side, so it shows the before accent colour. A
component change in the rendered HTML changes the consumer's bytes instead.

### Format Versions And Merge Order

Index v8 came with #217 after the 0.16.1 release and is not released, so every
released viewer rejects an index v8 catalogue before it reads a detail or a
snapshot. Mokly Cloud accepts no index v8 yet, and its adoption plan adopts
the release that carries #217. Under decision 3 option A:

- While index v8 is unreleased, the index keeps v8, and its inventory row
  names the shared documents. If a release carries index v8 before this
  change merges, the change takes the next index number, or the number that
  another unreleased change already set.
- The entry detail keeps the number on `main` at merge time: v2 today, or the
  number that dedup 1 or dedup 3 sets. `sameDocument` is an additive optional
  field, like `state` and `before` in #217.
- Removed preview metadata v3, export ownership v3, upload metadata v3, and
  the Plan exchange v1 do not change.

The other dedup changes can merge in any order:

- Dedup 1 and dedup 3 change the entry detail, but the marker touches neither
  `deploymentId` nor the workspace lists. The second merge keeps both edits in
  `DetailView`, its validation, the generated types, the detail fixture, the
  viewer reader, and the protocol pages, with the higher number. A renamed
  `EntryDetailV2` or fixture takes the marker with it.
- Dedup 2 changes the upload exchange. Fewer before files only shorten the
  Plan inventory. When both edit `mokly-upload-validation.md`, keep both rules.
- This change keeps the generation id algorithm, so it does not conflict with
  a dedup 1 change to deployment identity.

## Milestone 1: Documentation And Protocol

State the shared-document rule, the marker, the pane source, the receiver
rule, and the decisions in force, after the user answers decisions 1 to 4.

- [ ] Record each answered decision in this plan, with its date, its
      alternatives, and its reason.
- [ ] `mokly-comparison-serving.md` and `mokly-selected-comparisons.md`: the
      generation stores a shared document once, at its after address, and
      the detail marks the view. State what stays on the before side, with
      decision 1 in force beside the rule. Selected generations keep a shared
      document's before closure.
- [ ] `mokly-export-delivery.md` and `mokly-changes-serving.md`: replace
      "every before and after document" and "the snapshots of both sides"
      with the stored set, and link the rule.
- [ ] `mokly-artifact-paths.md` and `mokly-comparison-panes.md`: the before
      pane of a shared view fetches the after address, checks the final URL
      against it, and presents the body with its own address. One fetch
      serves both panes.
- [ ] `mokly-shell-delivery.md`, `mokly-catalogue-serialization.md`, and
      `mokly-format-versions.md`: `sameDocument`, its presence rule from
      decision 4, and the numbers from decision 3.
- [ ] `mokly-upload-validation.md`: the receiver rule from decision 2.
- [ ] Confirm that the removed previews, comparison records, viewer
      namespace, and static build pages stay true. Change nothing else.
- [ ] Add the status line of `AGENTS.md` to each changed page whose behaviour
      is not implemented yet. Run the Markdown checks, commit, and push.

## Milestone 2: Mokly Cloud Handoff

On its `main`, Mokly Cloud rejects an upload with `Rejection::Snapshot` when a
review v6 view lacks a snapshot document. Its adoption plan on branch
`conductor/adopt-mokly-without-reviewjson` replaces that reader, and its open
decision 6 recommends removing the check. A check that requires a before
document for every compared view would reject each publication with a shared
document.

- [ ] Send the receiver rule and links to the changed protocol pages to the
      Mokly Cloud workspace "Adopt Mokly without review.json"
      (`conductor://workspace?id=1b603283-dbbe-448f-a720-705e5b13bc8e`). Ask
      it to keep decision 6 at A, or to read `sameDocument` from the details.
      Record its answer here.

## Milestone 3: Shared-Document Marker

The classification, the details, both readers, and the viewer learn the
marker. `build` and Serve still store every before document, so the product
works at the end of this milestone.

- [ ] `mokly-compare`: add `same_document` to `DocumentComparison` and set it
      in `comparison_views::collect`. Test equal and different bytes, moved
      and renamed pairs, one-sided views, and page documents. Test that
      `render` and `comparison_document` return equal bytes on a source
      generation and on a capture.
- [ ] `mokly-model`: add `same_document: Option<True>` to `DetailView`, with
      the decision 4 checks in `detail_validation.rs`. Test the round trip
      and each rejected placement.
- [ ] `projection_detail::apply_evidence`: copy the flag into current details
      only, and test that removed details never carry it. Run
      `cargo xtask generate-types`, and add one marked view to the detail
      fixture under `docs/protocol/fixtures/`.
- [ ] Viewer: read the marker, carry it in `ReviewView`, and give the before
      pane of a shared view the after source. Carry sources through the
      comparison documents and the loader, with one fetch per source. Test the
      reader, the selection, the loader's URL check and base, and the fetch
      count.
- [ ] `tests/comparison_record_bytes.test.ts`: add `sameDocument` to the
      compared facts, and give the fixture one shared view. Update the READMEs
      of `mokly-compare`, `mokly-model`, and the viewer's `previews` and
      `shell` areas.

## Milestone 4: Store Shared Documents Once

`build` and Serve stop storing the before documents of shared views.

- [ ] `mokly-static`: skip shared before documents in `comparison_files::side`.
      Test that the before side keeps every resource, every removed and moved
      document, and every unshared document, and that the generation id hashes
      exactly the stored files.
- [ ] `mokly-server`: skip shared before documents in `SnapshotCapture` and
      keep their before closures. Test the stored set and the byte budget.
- [ ] Add `tests/static_shared_documents.test.ts`: one changed screen and one
      unchanged screen, plus a stylesheet-only change. Assert the exact
      generation file set and each view's marker.
- [ ] Add `tests/browser/comparison_shared_documents.spec.ts` on the copied
      comparison fixture. `screens/changed` loads both sides' documents.
      `screens/consumer` requests no before document, requests each after
      document once, and fails no request. Its before pane shows
      `accentColor.Before` and its after pane `accentColor.After`.
- [ ] Add a Serve case to `tests/browser/serve_selected_comparisons.spec.ts`:
      the shared before document answers 404, and the panes render.
- [ ] Update the Rust, Node, viewer, and browser tests that read a shared
      before document. Update the READMEs of `mokly-static` and
      `mokly-server`. Remove the status lines that Milestone 1 added.
- [ ] Run the mockup check of `AGENTS.md`. Its before side holds only
      resources and page documents. Smoke-test a comparison in Serve and in a
      static build with no failed snapshot request.

## Milestone 5: Verification, Commit, Review, And Pull Request

- [ ] Apply decision 3 to the versions on `main` at merge time, after any
      merge of dedup 1, 2, or 3.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] Release the change. Mokly Cloud pins that release.
- [ ] Measure the before side of a catalogue with large images. If resources
      dominate it, propose decision 1 option B again.
