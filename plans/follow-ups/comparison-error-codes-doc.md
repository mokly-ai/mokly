# The protocol lists error codes that nothing reads

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from the branch `calummoore/mokly-viewer-responsibilities`: the second options check of the plan for the viewer's leftover layers, decision 5, option E.
- **Location:** `docs/protocol/mokly-comparison-serving.md:85-98`.
- **Reason:** On 2026-11-02 the user chose option E and asked for it in a later branch, after the branch that applied option D merges.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Serve:** the `mokly serve` development server. It prepares a comparison on request.
- **Background:**
  - When a comparison route of Serve fails, it answers `{ code, message }`.
  - On 2026-11-01 the user chose option D: the shell maps Serve's code to one sentence that it owns, and the protocol lists the codes. `docs/protocol/mokly-comparison-serving.md:85-98` now lists `invalid-input`, `comparison-unavailable`, and `not-found`.
  - Every failure shows the same details sentence, "The comparison is unavailable.", which `docs/protocol/mokly-comparison-panes.md` states. So the shell reads no code.
  - On 2026-11-02 the user chose option E, to apply in a later branch.
- **Problem:** The list of codes is a requirement on Serve that no reader uses.
- **Impact if no action:** The list can drift from Serve with no visible effect.
- **Root question:** What does the protocol say about the body of a failed comparison request?
- **Options:** The letters follow the options of decision 5.
  - **D.** Keep the list of codes. Effort: Small.
  - **E.** Keep only the rule that the shell never shows `message` and shows the one sentence for every failure, and drop the list of codes. Effort: Small.
  - **F.** E without the details line, so a failure shows only its headline and Try again. It changes `docs/protocol/mokly-comparison-panes.md:138-142` and a `@mokly/ui` component. Effort: Medium.
- **Left out:** None.
- **Wider fix:** E, because the failure state then owns its text and the protocol keeps no unused list.
- **Previous examples:** None found.
- **Recommendation:** E. It gives the same behaviour without a requirement that no reader uses.
- **Action:** fix after merge, apply E, because the user chose E on 2026-11-02 and asked for it in a later branch.
