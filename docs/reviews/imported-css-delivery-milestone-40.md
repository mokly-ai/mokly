# Imported CSS Delivery Milestone 40 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 40. It ran on 2026-10-01 after `99d695b2` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main` at `5d1c37a`. Two read-only reviewers examined the changes since
`840fe8d6`. One covered the documentation reconciliation; the other covered
tooling, tests and the release merge. The changes were:

- `c260b5b2` and `60352062` (Milestone 38): the user's decisions on the 13
  [Milestone 37](./imported-css-delivery-milestone-37.md) findings.
- `3a2d90a8` (Milestone 39): the merge of `main`'s 0.13.0 release commit.
- `99d695b2`: bookkeeping.

Findings that remain open in earlier records are not repeated.

The reconciliation holds:

- **Superseded sentences.** The docs reviewer checked all 92 sentences that
  the crosswalk marked as superseded, against `main`'s pages and the code.
  None still describes current behaviour without an equivalent on a current
  page.
- **Pages.** `main`'s relocated pages are intact apart from approved edits
  and the items below. Protocol pages share no duplicated sentences and no
  titles. Decisions 4, 5 and 6 are applied exactly.
- **Ratchet base rule.** It behaves as decided in 13 scenarios: no merge,
  merging `origin/main`, merging another branch, a local `main` ahead,
  `main` moving during a merge, a detached `HEAD`, and a missing or
  unrelated `origin/main`. Normal runs match `main`'s behaviour.
- **Length policy.** It keeps `main`'s cap rules exactly, and a changed
  capped page passes only within its cap.
- **Release merge.** `package.json` keeps the branch's sorted dependencies
  with versions 0.13.0 and 0.4.0. The release's other seven files are
  identical to `main`, and `npm ci` succeeds.
- **Mutation tests.** The new ratchet, length, capture, fixture, route,
  binary-publishing and declaration tests fail when their behaviour is
  broken.
- **Gate and CI.** The full gate passed. PR #125's CI passed after one
  re-run (finding 12).

Most findings concern the new merge-preservation check: it can report success
while passages are missing. The parent session confirmed findings 1, 3, 6 and 10. All twelve remain open for the user's decision.

## Findings

1. **Medium — the merge check reports success when it cannot read the
   result.**
   - What happens: any Git read failure is treated as "file not in the result",
     and that file is skipped. The `--result` value is never validated.
   - Reproductions:
     - `merge-preservation.mjs d72abaeb --result HAED` prints "passed for 135
       overlapping path(s)" and exits 0, while `--result HEAD` reports 38
       passages.
     - A file that the result renamed or deleted is skipped, so an edit that
       followed a rename and was then dropped passes.
     - A file over 64 MB is skipped after commit.
     - With `color.ui=always`, nothing is parsed and every merge passes.
     - No test fails if the skip is removed.
   - Impact: the command documented in `AGENTS.md` can declare success with
     dozens of passages missing.
   - Options: A) fail instead of passing: validate both revisions, report the
     passages of a missing path as renamed or removed, exit 2 on any other Git
     error, add `--no-color`, handle large files, and add one test per case;
     B) only validate `--result`; C) document the limits.
   - Recommended: A. The root cause is a catch-all that turns unexpected
     states into "nothing to check".
   - Resolved in `7f64f8b0`: Removed the custom check. Reviewers now use Git's `--remerge-diff`, which compares against Git's own merge without the script's unreadable-result and deleted-file skips.
2. **Medium — the merge check does not look where the last merge actually lost
   content.**
   - What happens: the check examines only files changed on both sides, and
     within them it skips any change that overlaps the other side's changes.
   - Evidence from the real merge `d72abaeb`:
     - The two `mokly-css-attribution.md` clauses that the Milestone 37 review
       found lost were never reported. The branch's paragraph overlapped a
       paragraph that `main` reworded.
     - Twenty files that only `main` changed differ from `main`'s version in
       the merge result, and none was checked. They include
       `scripts/verification/ratchets/git.mjs`, 52 removed lines in
       `tests/server_changed.test.ts` and 7 in
       `tests/protocol_doc_sizes.test.ts`. The Milestone 37 review found every
       `main` test title still present, so the server test lines appear to
       have moved, but the check cannot tell.
     - Undoing `main`'s only change to a file during a scratch merge passes as
       "0 overlapping paths".
   - Impact: "passed" can coexist with `main`'s code, tests or docs being
     overridden, which the "Mainline Feature Preservation" rule exists to
     prevent.
   - Options: A) build on Git's own three-way merge: require one-sided lines
     outside real conflict regions to survive, list dropped lines inside
     conflict regions for justification, and report any difference from the
     only changed side for files one side alone changed; B) keep the current
     approach, but also check one-sided files and report dropped lines from
     overlapping changes as conflicts; C) document the limits.
   - Recommended: A, with test cases shaped like the two real misses and a
     short description of what the check covers.
   - Resolved in `7f64f8b0`: Removed the custom check. Git's `--remerge-diff` exposes conflict resolutions and edits to one-sided files, including the cases the script missed.
3. **Medium — the URL classification rule still disagrees with the code for
   root-absolute CSS URLs.**
   - What happens: `classifyResourceUrl` treats a root-absolute `/x.png` as
     invalid in both CSS and HTML. Only `//` differs: it is external in CSS
     and invalid in HTML.
     - `mokly-changes-serving.md` says "HTML protocol-relative and
       root-absolute URLs fail", which reads as if only HTML root-absolute URLs
       fail.
     - `mokly-removed-previews.md` was rewritten to "rejects non-portable HTML
       URLs". To fit the page's cap, the rewrite also dropped some of `main`'s
       wording beyond the approved edit: "single historical document",
       "transitive", the Git asset reader and the bounded batches.
     - The new text says export uses the same classification, but export's
       link check accepts root-absolute links.
   - Impact: readers would expect `url(/x.png)` in public CSS to work, but it
     fails comparison and removed-preview capture.
   - Options: A) state the rules exactly and restore `main`'s removed-preview
     sentence with only the CSS `//` exception; B) A, plus a small table of
     URL form, document type and outcome that a unit test checks against
     `classifyResourceUrl`.
   - Recommended: B. This text has drifted from the code twice, and the table
     test stops a third time.
4. **Low — a dropped line counts as kept if the same text appears elsewhere in
   the file.** A dropped `assert.equal(result.status, 0);` passes when the same
   assertion appears elsewhere. A dropped Markdown rule passes when a longer
   surviving line starts with the same text. A dropped line beginning with
   `++` is never examined. Options: A) count occurrences and match whole lines,
   and treat only `+` lines after a hunk header as additions; B) adopt finding
   2's option A, which replaces this matching. Recommended: B if finding 2
   takes option A, otherwise A.
   - Resolved in `7f64f8b0`: The custom line matcher was removed. Git's `--remerge-diff` shows actual changes from its automatic merge, so loose matching and skipped `++` lines no longer apply.
5. **Low — the new URL heading splits `main`'s "Comparison engine" section.**
   The heading inserted in `mokly-changes-serving.md` files `main`'s
   `review.json` description and its `schemaVersion: 4` interface under the URL
   rules. Four links labelled "review result v4" still point at
   `#comparison-engine`, and a sentence says "the rule linked above" where no
   such link remains. Options: A) move the URL text into its own section just
   before "Review Ignore", leaving `main`'s sections untouched, and link that
   sentence to `mokly-changes.md#changes-membership`; B) add a "Review Result
   v4" heading and re-point the links. Recommended: A.
6. **Low — some statements went stale when the fixes landed.**
   - `ci-verification-repository.md` and `xtask/README.md` still say that the
     length audit compares against `origin/main` during a merge. After
     decision 7 it does so only when merging the exact `origin/main` tip.
   - The protocol index still says the configuration contract includes
     public-exclusion validation, which now lives in
     `mokly-configuration-discovery.md`.
   - The Milestone 37 record still says "thirteen remain open", although every
     finding is now marked resolved.

   Options: A) fix the three statements; B) A, but replace both merge-rule
   descriptions with a link to `verification-ratchets.md` so that one page
   owns the rule. Recommended: B.

7. **Low — three edits re-add or keep text that `main` changed or removed.**
   These are not branch-only rules, so decision 1 did not approve porting them.
   - `mokly-css-attribution-membership.md` adds a sentence about "saved-view"
     analysis that repeats a later rule, which `main` reworded to
     "variant-view".
   - `mokly-export-public-files.md` re-adds a legacy-migration test sentence
     that `main` deleted in `b4314fe`.
   - `docs/reviews/watched-child-lifecycle.md` keeps the branch's link label
     "source-inventory contract" instead of `main`'s "source-protection
     contract".

   Options: A) remove the two sentences and restore `main`'s label; B) get
   approval to keep them. Recommended: A. Also add a step to the merge
   procedure: before porting a sentence from a deleted page, compare it with
   the merge base, because only text the branch added can be ported without
   asking.

8. **Low — some rules are still stated on more than one page.** The
   imported-CSS export capture is described in `mokly-export.md` and
   `mokly-export-public-files.md`. Generated stylesheet link order appears in
   four pages: `mokly-rendering.md`, `mokly-rendering-generated.md`,
   `mokly-configuration-imported-styles.md` and
   `mokly-imported-styles-assets.md`. The overlap test catches only identical
   sentences, so reworded copies pass. Options: A) keep each rule on one page
   and replace the other copies with a one-line link, plus a note in the
   protocol index that a parent page links to rules its child page owns; B) a
   fuzzy-overlap test, which would raise too many false alarms. Recommended:
   A.
9. **Low — two new guards skip some of what they claim to check.**
   - The error-catalogue test checks only the last code span in each row, so it
     skips two of the 58 rows ("Committed generated files ignored by Git" and
     "Empty CSS Modules selector wrapper"). Changing either message in `src`
     leaves the test passing.
   - The structure test checks only pages that start with "Continuation of",
     and the index test checks a fixed list of 16 pages. An unlinked,
     unindexed page passes every protocol test.

   Options: A) make the catalogue test pick each row's message deliberately
   and assert that every row is checked; B) also derive the index check from
   the directory listing, so every protocol page must appear in the index.
   Recommended: B, as a rule that guards fail on entries they cannot parse
   instead of skipping them.

10. **Low — a link in `main`'s Delta Publishing plan now points at a missing
    section.** `plans/delta-publishing.md` links to
    `npm-release.md#release-management`, which now lives in
    `npm-release-management.md`. The Markdown link test does not check
    `plans/`. Options: A) re-point the link; B) A, and extend the link test to
    all tracked Markdown, skipping or validating line anchors. Recommended: B.
11. **Low — the new `AGENTS.md` merge-check step cannot be followed as written
    after a merge is committed, and this merge's justifications are not in
    Git.**
    - The step says to justify reported passages in the merge commit body,
      including after follow-up fixes, but a committed merge's body cannot
      change.
    - The 38 justifications for this branch's merge exist only in an ignored
      file, `.context/merge/m38-doc-crosswalk.md`.
    - The check's limits (findings 1 and 2) are not written down.

    Options: A) say where follow-up justifications go (the fix commit body or
    the PR description), put a short table of the 38 justifications into
    PR #125, and document the check's limits beside the other verification
    tools; B) commit the crosswalk as a tracked record under `docs/reviews`;
    C) let the script read a tracked justification file and fail only on
    unlisted passages. Recommended: A, moving to C if merges from `main` stay
    frequent.
    - Resolved in `7f64f8b0`: `AGENTS.md` directs intentional merge justifications to the PR description, which can change after the merge commit. The removed custom check's limits no longer apply; the user maintains PR #125's description.

12. **Low — two imported-CSS watcher tests are flaky on CI.** PR #125's CI
    failed once on Node 22.14.0 and passed when only the failed jobs were
    re-run:
    - "watched Serve closes after a PostCSS worker exits during rebuild"
      failed with "worker request hung";
    - "real watcher reloads an imported entry stylesheet beneath dist" failed
      to see `color: blue`.

    The same run's Hydration failure ("development React hydrates removed and
    replaced finalized routes") also failed on `main`'s own CI at `0c8245f8`,
    so it is a pre-existing `main` flake and not a finding here.

    Options: A) make both tests wait for explicit events, such as the
    worker-exit notification and the rebuild report, instead of time-based
    polls, and run each 20 times in a loop to confirm; B) raise their
    timeouts; C) leave them.
    Recommended: A. The Milestone 17 review already found these real-watcher
    tests weak.
