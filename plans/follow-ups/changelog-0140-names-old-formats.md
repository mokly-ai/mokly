# The 0.14.0 changelog names wrong format versions

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-17, from the first point of `plans/follow-ups/mokly-0140-inconsistencies-unreported.md`, which the cloud's adoption of Mokly 0.14.0 in its PR #35 found. The move of Mokly Cloud into this repository split that item.
- **Location:** `CHANGELOG.md:653`.
- **Reason:** A fix edits the published release notes of an old release, which the user decides.

- **Source:** Review.
- **Category:** Docs or spec.
- **Background:**
  - The 0.14.0 entry of `CHANGELOG.md:653` says: "Rebuild manifest v8 and consume read model v4, review result v5".
  - The format inventory of the release, `docs/protocol/mokly-format-versions.md` at the tag `v0.14.0`, lists the private generated manifest 9, the public catalogue 5, and the review result 6.
  - Release Please wrote the entry from a commit message, and the GitHub release of 0.14.0 carries the same text.
  - Later releases removed or replaced these formats. Release 0.17.0 removed the review file.
- **Problem:** The 0.14.0 release notes name format versions that the release did not ship.
- **Impact if no action:** A reader of the old notes gets wrong version numbers. No current release reads these formats, so no current consumer is affected.
- **Root question:** Does this repository correct the published notes of an old release?
- **Options:**
  - **A.** Keep the notes as they are. The format inventory at each release tag holds the right numbers. Effort: Small.
  - **B.** Correct the line in `CHANGELOG.md` and in the GitHub release of 0.14.0. Effort: Small.
- **Left out:** A note in a later release. It would describe formats that no current release has.
- **Wider fix:** None. The cause was one commit message, and the format inventory already owns the numbers.
- **Previous examples:** None found.
- **Recommendation:** A. The formats are gone, and the right numbers stay in the inventory of the release.
- **Action:** ask the user, because B edits published release notes.
