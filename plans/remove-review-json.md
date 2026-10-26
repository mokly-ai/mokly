# Remove The Comparison Review File

Status: Active. On branch `calummoore/reviewjson-purpose`, no pull request yet. The plan closes when its PR merges.

A comparison generation holds one `review.json`: the review result v8 of
every screen, component, variant, and use case. The file grows with every
rule record of every added or changed view, and each record repeats the full
stylesheet path, so a static host with a per-file limit, such as Cloudflare
Pages with 25 MiB, rejects a large comparison (user items 187 and 189 of the
[Rust rebuild plan](./rust-rebuild.md)). Most of the file repeats data that
other files already carry. Each entry detail carries the same rule and
resource evidence (rebuild Decision 30), and the index carries each entry's
change state, title, and previous path. The static viewer downloads and
validates the whole file for each entry that a reader compares, and then
uses one record. Mokly Cloud reads the file on its server for Plan
validation, completion, the GitHub check, and its screens API, but it parses
review v6 only, so it rejects every 0.16 publication that includes Changes.

User decision 189 (2026-10-26): E, remove `review.json`. The rejected
options were A, keep the compact file; B, a review v9 with one stylesheet
table that rule records reference; C, one review file per entry; and D, a
small review summary that only receivers read. The reason: the index already
holds every fact that Mokly Cloud reads, and Mokly Cloud must replace its
review v6 parser anyway, so a second change record only adds a format to
maintain and a way for the GitHub check to disagree with the viewer. The user
also asked for the Mokly Cloud change to be planned here and carried out in
a separate workspace of the `mokly-cloud` repository.

The index and the entry details become the only public comparison records.
The comparison keeps its classification record in memory, as it keeps the
change snapshot, and writes no review file:

- Catalogue index v8 adds `baseCommit`, present exactly while Changes is
  ready. Its `comparisonUrl` names the root of the comparison generation,
  `mokly-viewer/diffs/generations/<generation>/`, not a file.
- Entry detail v2 gains optional fields: each screen and component view
  carries its `state` and its `ignoredIds` beside `resourceEvidence`, under
  the same presence rule, and a ready current screen or component with a base
  side carries `before`, the base side's path, title, saved props, and
  supplied slots. The serialization contract treats optional fields as
  additive, so the detail keeps version 2. The index changes the meaning of
  `comparisonUrl`, so it needs version 8.
- A comparison generation holds the removed entries' details, the removed
  page and document previews, and the snapshots with their resources.
- Serve replaces `/mokly-viewer/diffs/review.json?path=` with
  `/mokly-viewer/diffs/selection?path=`, which redirects to the selected
  generation's root. Each generation root answers GET and HEAD with 204 and
  renews the generation's retention.
- The shell compares an entry from the index and the routed entry's detail.
  A static comparison requests only snapshot documents.
- The upload envelope v3 drops `comparisonPath`. The Plan archive always
  carries `mokly-viewer/index.json` as its third file, and receivers read
  Changes from the index.

This change does not rename the in-memory classification types, and it does
not ship the Mokly Cloud change, which has its own pull request in that
repository. The shell's screens and copy do not change, so the change has no
mockup milestone. Each format bump changes its writer and its reader
together, because every reader accepts exactly one version, so the Rust and
viewer work share their milestones.

Contract owners:

- [Tree comparison and Changes](../docs/protocol/mokly-comparison.md).
- [Shell delivery](../docs/protocol/mokly-shell-delivery.md) and the
  [catalogue contract](../docs/protocol/mokly-catalogue.md).
- [Comparison generation and serving](../docs/protocol/mokly-comparison-serving.md)
  and [selected live comparisons](../docs/protocol/mokly-selected-comparisons.md).
- [Static delivery](../docs/protocol/mokly-export-delivery.md) and the
  [viewer namespace](../docs/protocol/mokly-viewer-namespace.md).
- [Catalogue upload](../docs/protocol/mokly-upload.md) and the
  [upload exchange](../docs/protocol/mokly-upload-exchange.md).
- [Format versions](../docs/protocol/mokly-format-versions.md).

## Milestone 1: Documentation and protocol

Write the requirements and the decision of the change into the protocol
docs, so that the code milestones and the Mokly Cloud work have one contract.

- [x] Rewrite the review result section of `mokly-comparison.md` as the
      in-memory classification and name where its public facts appear.
      Align the component comparison records and review pages.
- [x] State index v8 in `mokly-catalogue.md` and the new entry detail
      fields in `mokly-shell-delivery.md`, with the route table.
- [x] State the generation contents, the selection endpoint, the generation
      root, and renewal in the comparison serving, selected comparison,
      on-demand, runtime, Changes serving, and viewer namespace pages.
- [x] State static comparisons without the review file in the export,
      export delivery, export browser, catalogue delivery, serialization,
      artifact path, removed preview, and comparison pane pages.
- [x] State upload envelope v3 and the Plan archive with the index in
      `mokly-upload.md`, `mokly-upload-exchange.md`, and the upload guide.
- [x] Update `mokly-format-versions.md`, including what Mokly Cloud
      implements.
- [x] Remove the remaining live mentions of `review.json` and review v8 from
      the protocol index, the architecture doc, and the other protocol pages.
- [x] Add the breaking comparison records release note to
      `npm-release-notes.md`.
- [x] Run the Markdown checks, then commit and push.

## Milestone 2: Mokly Cloud handoff

Mokly Cloud must adopt index v8 and envelope v3 in its own repository. Its
contract crate pins released Mokly versions and regenerates fixtures from
them, so it finishes after the release.

- [x] Create a Conductor workspace in `mokly-ai/mokly-cloud` whose agent
      plans and implements the receiver change against the protocol docs of
      this branch: parse the envelope v3 and the index v8 from the Plan
      archive, take change counts, entries, moves, and screens from the index,
      and retire the review v6 parser. Record the workspace here.
  - Created on 2026-10-26: workspace "Adopt Mokly without review.json"
    (`conductor://workspace?id=1b603283-dbbe-448f-a720-705e5b13bc8e`), one
    Claude session with the brief in
    `.context/remove-review-json/cloud-brief.md`. Its plan adopts the release
    that carries this change, including the 0.16 Rust core formats, and it
    keeps the pins and fixtures until that release is on npm.

## Milestone 3: Comparisons from the index and the entry details

Write and read index v8 and the new detail fields, stop writing the review file,
and compare from the index and the details in every host. Milestones 3 and 4
landed in one commit, because the publish check reads the index that
Milestone 3 changes.

- [x] Model: index v8 and detail field shapes, validation, readers, and
      versions; the generation root route; no public review reader or
      generated review type.
- [x] Comparison projections: fill `baseCommit`, view `state` and
      `ignoredIds`, and `before` in current and removed details.
- [x] Static build: write no review file and advertise the generation root.
- [x] Serve: classification and selected generations without the review
      file, the selection endpoint, and the generation root route.
- [x] Viewer: the index v8 reader and the new detail fields; comparisons,
      Details, and removed previews from the index and the details; no
      review reader.
- [x] Regenerate the TypeScript types and the protocol fixtures.
- [x] Update the Rust, Node, viewer, and browser tests and their fixtures.
  - The viewer-side rule evidence cases of the removed review reader moved
    to the Rust review validation tests.
  - Evidence: `.context/remove-review-json/browser-tests-run1.log` and
    `browser-rerun2.log` to `browser-rerun4.log`.
- [x] Update `scripts/large` and `scripts/rebuild`.
  - The rebuild adapter keeps reading the earlier Rust captures of index v7
    and review v8; its declaration no longer imports a removed type.
- [x] Update the crate, viewer, and test READMEs.
- [x] Run the mockup check and smoke-test Serve and a static build.
  - Evidence: `.context/remove-review-json/smoke-results.md`.

## Milestone 4: Upload envelope v3

Send the index in the Plan request and drop the review path from the
envelope.

- [x] Write and read envelope v3 without `comparisonPath`.
- [x] Put `mokly-viewer/index.json` third in the Plan archive. Check the
      index's `base` and `baseCommit` against `baseRef` and `baseSha`.
- [x] Update the receiver helpers, tests, and fixtures.

## Milestone 5: Verification, commit, review, and pull request

- [x] Run the targeted tests and the complete gate named in `AGENTS.md`.
  - Evidence: `.context/remove-review-json/gate3.log`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - Review 1: `.context/remove-review-json/review-1.md`. Findings 1, 2, 3,
    5, 7, 8, and 9 were fixed.
  - 4. Root GET of a selection ends aborted. Severity Low, effort Small.
       Recommended: B, answer 200 with an empty body once a browser check
       proves that it ends the abort.
  - 6. Parity test skips the published evidence. Severity Low, effort Small.
       Recommended: A, compare each view's `resourceEvidence` too.
  - 10. Version error type still allows review. Severity Low, effort Small.
        Recommended: A, remove `"review"` and name it in the release note.
  - 11. Decision: the viewer no longer rejects a non-public evidence path
        that a loaded review carried. Severity Low, effort Small. Recommended:
        A, keep the producer's check only.
  - Review 2 of the fix commit: `.context/remove-review-json/review-2.md`.
    Its findings 1 and 2 were fixed.
  - 12. Plan ticks the review TODO before the re-review. Severity Low,
        effort Small. Recommended: A, keep the tick and record review 2.
  - `tests/browser/large_watch.spec.ts`: the React journey timed out once
    after 300 s in remote shard 1 of 4 and passed on rerun. Separate branch.
  - `docs/protocol/mokly-upload-validation.md`: the rejection table names no
    status for an unsupported catalogue index version in the Plan archive.
    Separate branch.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] Release the change as a minor version with a breaking-change note.
- [ ] Mokly Cloud pins that release, regenerates its contract fixtures, and
      ships its receiver change.
