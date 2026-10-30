# Deploy Mokly Cloud without review.json

- **Severity:** High (estimate). **Effort:** Medium (estimate).
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #217 and its completed plan, an unchecked
  post-merge task.
- **Location:** None in this repository. The receiver lives in
  `mokly-ai/mokly-cloud`. The formats that it reads are in
  `docs/protocol/mokly-format-versions.md:16` and
  `docs/protocol/mokly-upload-exchange.md`.
- **Reason:** The contract crate of Mokly Cloud pins released Mokly versions
  and regenerates its fixtures from them, and release 0.17.0 with PR #217
  shipped only on 2026-10-29.

- **Terms:**
  - **`review.json`:** the comparison review file that each comparison
    generation held before PR #217. It carried the review result of every
    changed view.
  - **Plan archive:** the gzip tar that `mokly publish` sends in its Plan
    request. It holds the upload envelope, the ownership marker, and the
    catalogue index.
- **Background:**
  - On 2026-10-26 the user chose to remove `review.json`, because the index
    already holds every fact that Mokly Cloud reads. The user rejected a
    compact review file, a review format with one stylesheet table, one
    review file for each entry, and a small summary for receivers only.
  - The user also asked that the Mokly Cloud change is planned in this
    repository and carried out in the `mokly-ai/mokly-cloud` repository.
  - PR #217 merged on 2026-10-27. Catalogue index v8 adds `baseCommit`, and
    its `comparisonUrl` names the root of the comparison generation. Upload
    envelope v3 drops `comparisonPath`. The Plan archive always carries
    `mokly-viewer/index.json` as its third file, and receivers read Changes
    from the index.
  - Before the change, Mokly Cloud read `review.json` on its server for Plan
    validation, completion, the GitHub check, and its screens API. It parsed
    review v6 only, so it rejected every 0.16 publication with Changes.
  - Release 0.17.0 shipped the change on 2026-10-29 as a breaking change.
    Its changelog says that receivers that read index v7, `review.json`, or
    envelope v2 must upgrade.
- **Task:**
  1. In `mokly-ai/mokly-cloud`, pin release 0.17.0 or a later release.
  2. Regenerate the contract fixtures from that release.
  3. Parse envelope v3 and the index version of the pinned release from the
     Plan archive. Take the change counts, the entries, the moves, and the
     screens from the index.
  4. Remove the review v6 parser.
  5. Deploy the receiver change.
- **Impact if no action:** Mokly Cloud cannot read the Changes of a
  publication from 0.17.0 or later. Its Plan validation, its completion, its
  GitHub check, and its screens API then fail for these publications.
- **Needs:** Release 0.17.0 on npm, and write and deploy access to
  `mokly-ai/mokly-cloud`.
- **Done when:** Mokly Cloud accepts a publication of its pinned release
  with Changes, reads its Changes from the index, and has no review v6
  parser left.
- **Related:**
  - [cloud-gzip-decoder-rollout.md](./cloud-gzip-decoder-rollout.md) and
    [cloud-parent-usage-lists.md](./cloud-parent-usage-lists.md) also pin
    release 0.17.0 in `mokly-ai/mokly-cloud`. One pin and one fixture
    refresh can serve all three tasks.
  - [mokly-cloud-index-v9.md](./mokly-cloud-index-v9.md) moves the same
    index parser from version 8 to version 9 after the next release.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/remove-review-json.md?plain=1#L238).
