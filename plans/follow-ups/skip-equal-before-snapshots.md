# Store each equal before snapshot only once

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the closed "dedup 4" workspace, and its
  unmerged plan at commit `181e44f2` on branch
  `conductor/dedup-4-skip-equal-before-snapshots`.
- **Location:** `crates/mokly-static/src/comparison_files.rs:31`,
  `crates/mokly-compare/src/comparison_views.rs:58`,
  `crates/mokly-compare/src/projection_detail.rs:13`,
  `crates/mokly-server/src/comparison_capture.rs:33`,
  `packages/viewer/src/catalogue/detail_comparison.ts:31`, and
  `docs/protocol/mokly-changes-serving.md:46`.
- **Reason:** The user has not answered the four open decisions of the
  plan, and the plan starts no milestone before the answers.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Comparison generation:** the directory
    `mokly-viewer/diffs/generations/{generation}/` that a build with Changes
    writes. It holds `snapshots/before/` and `snapshots/after/`.
  - **Pane:** one side of a comparison. The viewer shows the snapshot HTML
    with a `<base href>` at the pane's own snapshot address.
  - **Shared document:** a current screen or component view, at the same
    path on both sides, whose before and after documents have equal bytes.
  - **Entry detail:** the JSON file for each entry under
    `mokly-viewer/entries/` that the viewer reads.
- **Background:**
  - `side` in `crates/mokly-static/src/comparison_files.rs:31` copies
    every document, generated resource, and public file to each side.
    `docs/protocol/mokly-changes-serving.md:46` requires the snapshots of
    both sides.
  - On 2026-11-01, `main` at `c553bd6f` built `examples/basic` with the
    base equal to `HEAD`. Each side held 631 files, and all 631 pairs were
    equal. The before side was 12,440,910 bytes: 580 view documents of
    12,239,799 bytes, 10 page and Markdown documents, and 41 resources.
  - On 2026-10-27 the user chose this rule: write a before file only when
    its bytes differ from the after file, and let the viewer read the after
    file when the before file is absent.
  - The plan stores a shared document once, at its after address. The
    detail marks the view with `sameDocument: true`. The before pane
    fetches the after document but keeps its own base address, so its
    stylesheets still load from the before side.
  - Equal HTML does not mean that no change shows. A stylesheet-only change
    and an Unmodified view that uses a changed component still show the old
    styles in the before pane. The browser comparison fixture had 16
    stylesheet-only views on 2026-10-27.
  - `mokly publish` sends each digest once, so the saving is disk, build
    and Serve memory, and file count, not upload bytes. In the example the
    rule removes 98.4% of the before side. In the comparison fixture, with
    real changes, it removed 24.3% on 2026-10-27.
- **Problem:** A build with Changes writes a second copy of each unchanged
  view document.
- **Impact if no action:** Each output carries about 12 MB of copies in the
  example. Large catalogues reach the 20,000-file upload limit of
  `docs/protocol/mokly-upload-validation.md` sooner.
- **Root question:** How does a comparison show an unchanged view's before
  pane without a second copy of its document?
- **Options:** The user chose the rule. Four decisions stay open. Answer
  each by number and letter.
  1. **Before resources** (High). A changed before document requests its
     resources from the before directory, and no host can redirect it.
     **A.** Keep every before resource, and skip only shared documents.
     Effort: Large. **B.** Also skip a resource that only fully equal views
     use. It needs a resource comparison for each document. Effort: Large.
     **C.** Rewrite resource URLs to the after copies. It changes snapshot
     bytes, and the viewer cannot rewrite URLs inside stylesheets. Effort:
     Large.
  2. **Mokly Cloud receiver rule** (High). On 2026-10-27 Mokly Cloud
     rejected an upload when a compared view lacked a snapshot document.
     **A.** State in `docs/protocol/mokly-upload-validation.md` that a
     receiver does not require a snapshot document for each view, and send
     the rule to Mokly Cloud. **B.** Change no Mokly doc, and rely on Mokly
     Cloud to drop its check. Both Small.
  3. **Version guard** (Medium). A viewer that ignores `sameDocument`
     requests missing files. **A.** Guard with an unreleased index number,
     version 10 today, because 0.18.0 shipped version 9. Keep the marker an
     additive optional detail field. Small. **B.** Raise the entry detail
     number. Large. **C.** Add no number. Small.
  4. **Reader checks** (Low). **A.** Both detail readers reject the marker
     on an added, removed, moved, or comparison-less view. **B.** Readers
     accept it anywhere. Both Small. Option A is new validation.
- **Left out:** Drop the before side of every unchanged entry. The before
  pane of an equal document still shows old styles in the cases above.
- **Wider fix:** None. The rule itself removes the class of copies.
- **Previous examples:** PR #224 gave each entry detail a content id, so
  unchanged details keep their bytes.
- **Related:**
  - [unread-comparison-snapshots.md](./unread-comparison-snapshots.md): a
    rule that writes no snapshots for views that offer no comparison. The
    two rules work together.
  - [variant-prop-schema-copies.md](./variant-prop-schema-copies.md): it
    also needs a new index number. One release can carry both.
  - [cloud-without-review-json.md](./cloud-without-review-json.md): the
    Mokly Cloud work that decision 2 depends on.
- **Recommendation:** 1A, 2A, 3A, 4A. Shared view documents are 98.4% of
  the copy, and resource loading stays as it is.
- **Action:** ask the user, because the recommended options change the
  snapshot rule of two protocol pages, add a receiver requirement, and add
  new validation.

The full plan, with its design and five milestones, is in the [unmerged plan](https://github.com/mokly-ai/mokly/blob/181e44f22aef93ad4f5ce1e6c767d93ce7bf0276/plans/skip-equal-before-snapshots.md?plain=1).
