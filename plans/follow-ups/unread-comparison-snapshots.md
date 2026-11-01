# Builds write snapshots that no reader opens

- **Severity:** Medium. **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from decision 2 of the closed "Index and Ownership
  File Sizes" workspace, the proposed fifth decision and an outside-scope
  note of the closed "dedup 4" workspace, all of 2026-10-27.
- **Location:** `crates/mokly-static/src/comparison_files.rs:31`,
  `crates/mokly-static/src/comparison_output.rs:22`,
  `crates/mokly-compare/src/projection_index.rs:53`,
  `docs/protocol/mokly-changes-serving.md:46`, and
  `docs/protocol/mokly-export-delivery.md:168`.
- **Reason:** The fix changes the snapshot rule of two protocol pages, and
  the user has not chosen an option.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Comparison generation:** the directory
    `mokly-viewer/diffs/generations/{generation}/` that a build with Changes
    writes. It holds `snapshots/before/` and `snapshots/after/`.
  - **Comparable entry:** a current screen or component that the viewer can
    compare, under `docs/protocol/mokly-changes-controls.md`. An index view
    or the entry detail marks it eligible.
  - **Ownership marker:** the file `.mokly-export-artifact`, which lists
    every output file with its path, SHA-256 digest, and size.
- **Background:**
  - `side` in `crates/mokly-static/src/comparison_files.rs:31` writes every
    document, generated resource, and public file to both sides. The
    protocol pages above require the snapshots of both sides.
  - The viewer fetches a snapshot only for an eligible view and for the
    base side of a removed entry. An eligible view offers Side by side,
    Overlay, or Difference. With Both viewports selected, one eligible view
    makes the whole comparison eligible.
  - No host reads the snapshots of current page and Markdown documents.
    Only screen and component views have comparison panes.
  - On 2026-11-01, `main` at `c553bd6f` built `examples/basic` with the
    base equal to `HEAD`. No view of 580 was comparable. The build still
    wrote 1,262 snapshot files: 1,180 documents of 24,621,400 bytes and 82
    resources. The whole output was 2,383 files and 56,728,211 bytes.
  - Snapshot documents lack the inspector script of the current documents,
    so the after side is unique content. `mokly publish` uploads it, and
    Mokly Cloud stores it. `build` holds the whole output in memory before
    it writes the files.
  - In the browser comparison fixture, 19 of 32 entries were comparable on
    2026-10-27. Writing only comparable entries saved 30,464 bytes there.
  - Serve captures only the entry that a reviewer selects, so Serve has no
    such waste.
- **Problem:** A build with Changes writes both snapshot sides of every
  view, also of views that offer no comparison.
- **Impact if no action:** In the example, unread snapshots are 44% of the
  output bytes and 53% of its files. Large catalogues reach the 20,000-file
  upload limit of `docs/protocol/mokly-upload-validation.md` sooner.
- **Root question:** Which snapshot files must a build write so that every
  comparison that a host can open still loads?
- **Options:**
  - **A.** Change nothing. A deployment that needs no Changes builds with
    `--no-changes`, which removes the Changes view. Effort: Small.
  - **B.** Write snapshot documents only for every view of a comparable
    entry and for removed entries. Keep every snapshot resource. Update the
    generation rule of the two protocol pages. Effort: Medium (estimate).
  - **C.** B, and write only the resources that the kept documents use.
    Effort: Large (estimate).
- **Left out:** Decide eligibility in the viewer only. The writer already
  computes `eligible` for each view, in
  `crates/mokly-compare/src/projection_index.rs:53`.
- **Wider fix:** C. Then the generation holds only files that a reader
  can open.
- **Previous examples:** PR #220 stopped `build` from rendering the head
  five times, another case of work that no reader used.
- **Related:**
  - [skip-equal-before-snapshots.md](./skip-equal-before-snapshots.md):
    inside comparable entries it still removes equal before documents. The
    two rules work together.
  - [cloud-without-review-json.md](./cloud-without-review-json.md): Mokly
    Cloud must accept a generation without a snapshot for each view.
  - [snapshot-resource-copies.md](./snapshot-resource-copies.md): the after
    side also repeats the current resource files.
- **Recommendation:** B. It removes the largest unread part for the least
  code, and the resources that it keeps are 130,210 bytes for each side
  here.
- **Action:** ask the user, because option B changes the generation rule of
  `docs/protocol/mokly-changes-serving.md` and
  `docs/protocol/mokly-export-delivery.md`.
