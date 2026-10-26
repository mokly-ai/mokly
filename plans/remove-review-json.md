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
- Entry detail v3 gives each screen and component view its `state` and its
  `ignoredIds` beside `resourceEvidence`, under the same presence rule. A
  ready current screen or component with a base side also carries `before`,
  the base side's path, title, saved props, and supplied slots.
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

- [ ] Rewrite the review result section of `mokly-comparison.md` as the
      in-memory classification and name where its public facts appear.
      Align the component comparison records and review pages.
- [ ] State index v8 in `mokly-catalogue.md` and entry detail v3 in
      `mokly-shell-delivery.md`, with the route table.
- [ ] State the generation contents, the selection endpoint, the generation
      root, and renewal in the comparison serving, selected comparison,
      on-demand, runtime, Changes serving, and viewer namespace pages.
- [ ] State static comparisons without the review file in the export,
      export delivery, export browser, catalogue delivery, serialization,
      artifact path, removed preview, and comparison pane pages.
- [ ] State upload envelope v3 and the Plan archive with the index in
      `mokly-upload.md`, `mokly-upload-exchange.md`, and the upload guide.
- [ ] Update `mokly-format-versions.md`, including what Mokly Cloud
      implements.
- [ ] Remove the remaining live mentions of `review.json` and review v8 from
      the protocol index, the architecture doc, and the other protocol pages.
- [ ] Run the Markdown checks, then commit and push.

## Milestone 2: Mokly Cloud handoff

Mokly Cloud must adopt index v8 and envelope v3 in its own repository. Its
contract crate pins released Mokly versions and regenerates fixtures from
them, so it finishes after the release.

- [ ] Create a Conductor workspace in `mokly-ai/mokly-cloud` whose agent
      plans and implements the receiver change against the protocol docs of
      this branch: parse the envelope v3 and the index v8 from the Plan
      archive, take change counts, entries, moves, and screens from the index,
      and retire the review v6 parser. Record the workspace here.

## Milestone 3: Comparisons from the index and the entry details

Write and read index v8 and entry detail v3, stop writing the review file,
and compare from the index and the details in every host.

- [ ] Model: index v8 and detail v3 shapes, validation, readers, and
      versions; the generation root route; no public review reader or
      generated review type.
- [ ] Comparison projections: fill `baseCommit`, view `state` and
      `ignoredIds`, and `before` in current and removed details.
- [ ] Static build: write no review file and advertise the generation root.
- [ ] Serve: classification and selected generations without the review
      file, the selection endpoint, and the generation root route.
- [ ] Viewer: v8 and v3 readers; comparisons, Details, and removed previews
      from the index and the details; no review reader.
- [ ] Regenerate the TypeScript types and the protocol fixtures.
- [ ] Update the Rust, Node, viewer, and browser tests and their fixtures.
- [ ] Update `scripts/large` and `scripts/rebuild`.
- [ ] Update the crate, viewer, and test READMEs.
- [ ] Run the mockup check and smoke-test Serve and a static build.

## Milestone 4: Upload envelope v3

Send the index in the Plan request and drop the review path from the
envelope.

- [ ] Write and read envelope v3 without `comparisonPath`.
- [ ] Put `mokly-viewer/index.json` third in the Plan archive. Check the
      index's `base` and `baseCommit` against `baseRef` and `baseSha`.
- [ ] Update the receiver helpers, tests, and fixtures.

## Milestone 5: Verification, commit, review, and pull request

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] Release the change as a minor version with a breaking-change note.
- [ ] Mokly Cloud pins that release, regenerates its contract fixtures, and
      ships its receiver change.
