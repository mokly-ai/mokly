# Follow-up effort grades differ from their options

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-11-21, from `calummoore/mokly-cheaper-sidecar-describe-dlz0`,
  review round 1: the wider fix of finding 1 and a problem outside the review
  scope.
- **Location:** `plans/follow-ups/`, the 16 items listed below, and
  `skills/plans/templates/follow-up.md` line 3 in the `Firna-AI/skills`
  repository.
- **Reason:** The rule that would prevent the mismatch lives in the shared
  skills repository, which changes the instructions of every repository that
  uses the skills, so the user decides.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Follow-up item:** one Markdown file under `plans/follow-ups/` that
    records work for after a merge.
  - **Priority score:** the 0 to 10 score that `scripts/follow-ups.sh` of the
    shared `plans` skill computes from the grades on the first line of an
    item. Effort gives Small 2, Medium 1, and Large 0 points.
- **Background:**
  - The `decisions-and-findings` skill says that the effort of an item is the
    grade of its recommended option.
  - The follow-up template asks for an **Effort** grade on the first line, but
    it does not say that this grade is the grade of the recommended option.
  - `follow-ups.sh` reads only the first-line grade.
  - On 2026-11-21 a scan of `main` at 27ffad4b2 compared the first-line
    **Effort** of each item with the effort of the option that its
    **Recommendation** names. 16 items differ:
    - `blobless-base-read-extra-listing.md`: first line Medium, option B Small.
    - `build-sigterm-exit-delay.md`: Medium, option A Small.
    - `embedded-document-closures.md`: Medium, option C Large.
    - `mac-buttons-follow-measured-bar.md`: Large, option A Small.
    - `macos-serve-signal-test-cache-warning.md`: Small, option B Medium.
    - `marked-metadata-owner-timing.md`: Medium, option A Small.
    - `marked-sibling-file-candidates.md`: Medium, option C Large.
    - `node-24-crash-workaround.md`: Medium, option A Small.
    - `private-catalogues-lose-changes-and-blocked-cookie-access.md`: Large,
      option A Medium.
    - `public-links-require-sign-in.md`: Large, option B Small.
    - `rust-test-assertions-in-branches.md`: Large, option A Small.
    - `serve-head-generation-preload.md`: Medium, option A Small.
    - `serve-postcompile-import-proof-cost.md`: Medium, option A Small.
    - `serve-watch-candidate-plan-cost.md`: Medium, option A Small.
    - `stylesheet-cache-across-restarts.md`: Large, option B Medium.
    - `testbox-trusted-rust-cache.md`: Medium, option A Small.
  - Some of these first-line grades can be the grade of the whole job on
    purpose. Read each item before you change it.
- **Problem:** The first-line effort of these items is not the grade of their
  recommended option, so their priority scores are wrong.
- **Impact if no action:** `follow-ups.sh` orders these items wrongly, and new
  items repeat the mismatch, because the template does not state the rule.
- **Root question:** How does the priority score of each item use the effort
  of the option that the item recommends?
- **Options:**
  - **A.** Correct the first-line grade of the 16 items in this repository.
    It does not prevent new cases. Effort: Small.
  - **B.** Do A, and state the rule in the template placeholder of the shared
    `plans` skill: the first-line effort is the grade of the recommended
    option. Effort: Small.
  - **C.** Do A, and let `follow-ups.sh` read the effort of the option that
    **Recommendation** names when the item has options, so that the score
    cannot drift from it. Effort: Medium.
- **Left out:** A lint in this repository that compares the two grades,
  because C removes the case and a structural fix ranks above a detection fix.
- **Wider fix:** C. It removes the duplicate grade from the score.
- **Previous examples:** The 16 items above. The first round of the review of
  `calummoore/mokly-cheaper-sidecar-describe-dlz0` found the same mismatch in
  `plans/follow-ups/prepare-only-describe.md`, and that branch fixed it.
- **Related:** `plans/follow-ups/follow-up-code-lists-go-stale.md`: another
  rule for the shared `plans` skill from the same review. The two can change
  the skill in one pull request.
- **Recommendation:** B. It fixes the 16 items and prevents new cases with one
  sentence. C best protects the scores, but it changes a shared script.
- **Action:** ask the user, because B and C change the shared skills of every
  repository that uses them.
