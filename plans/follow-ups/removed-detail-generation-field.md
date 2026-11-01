# Removed detail docs disagree on `generation`

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the branch `calummoore/mokly-viewer-responsibilities`: outside the scope of the viewer investigation.
- **Location:** `docs/protocol/mokly-removed-previews.md:68`, `docs/protocol/mokly-removed-previews.md:146-147`, and `docs/protocol/mokly-shell-delivery.md:92-95`.
- **Reason:** The fix changes the words of a protocol requirement, and no recorded decision says which page is right.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Comparison generation:** a fixed directory,
    `mokly-viewer/diffs/generations/{generation}/`, that holds the details,
    preview metadata, and snapshot documents of removed entries. The index's
    `comparisonUrl` names it.
- **Background:** A removed entry's detail lives in a comparison generation.
  The generated `EntryDetailV4` type has no `generation` field, in
  `crates/mokly-model/src/public_detail.rs:140` and
  `packages/viewer/src/generated/catalogue/EntryDetailV4.ts`.
- **Problem:** `mokly-removed-previews.md:68` says that the removed detail
  "carries `generation` and `snapshotId`". Lines 146-147 say that the
  detail's `generation` confirms the generation. `mokly-shell-delivery.md:92-95`
  says that a removed detail carries no `generation`, and the code agrees.
- **Impact if no action:** A reader of the previews page can build a check
  that no real detail passes.
- **Root question:** What tells the viewer which generation holds a removed
  entry's documents?
- **Options:**
  - **A.** Edit `mokly-removed-previews.md` so that `comparisonUrl` alone
    names the generation. Effort: Small.
  - **B.** Add `generation` to the removed detail. A new field needs a new
    detail version, as `docs/protocol/mokly-format-versions.md` says.
    Effort: Large.
- **Left out:** Changing nothing fails the goal. Only two answers exist: the
  detail carries the field, or it does not.
- **Wider fix:** None, because the `documentation` skill already covers doc
  drift.
- **Previous examples:** `plans/follow-ups/viewer-usage-placement-docs.md`.
- **Recommendation:** A. The code, the generated type, and the shell delivery
  page already agree.
- **Action:** ask the user, because the fix changes the words of a protocol
  requirement, and no recorded decision says which page is right.
