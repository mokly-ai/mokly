# Added facts leave item fields out of date

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from rounds 4 and 5 of the review of the branch
  `calummoore/mokly-edit-background-render-olos`: the wider fix of findings
  11, 12, 14, 15, 16, 17, and 18.
- **Location:** `skills/plans/references/follow-up-items.md`, the sections
  "Writing an item" and "Keeping an item current", in the `Firna-AI/skills`
  repository.
- **Reason:** The fix is a new rule in the shared `plans` skill, which changes
  the instructions of every repository that uses the skills, so the user
  decides.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Follow-up item:** one Markdown file under `plans/follow-ups/` that holds
    every fact of work that waits until after a merge.
- **Background:**
  - The `plans` skill updates an item when a change replaces a decision or
    edits a protocol section ("Keeping an item current"). It asks for a
    search for the same problem only before a new item is added. It asks for
    a suspected source only in a flaky-test record.
  - No rule makes a writer who adds a fact to an existing item, such as an
    occurrence, a measurement, a revert, or an option, re-check the other
    fields of that item, search for the item that owns the same problem, or
    mark a cause that no test, run, or read of the code has shown.
  - On 2026-11-22 the docs change of the branch
    `calummoore/mokly-edit-background-render-olos` added the measured outcome
    of a reverted speed change to six items. Its reviews found these cases of
    the class:
    - `plans/follow-ups/serve-edit-background-pass-split.md` kept a
      Recommendation, an Impact, a Kind, and a Background rule that the new
      facts contradicted, and later recommended two cuts with no effort grade.
    - Three items described the reverted code as live, and named methods that
      the revert removed.
    - `plans/follow-ups/core-rss-retained-free-pages.md` stated an unproven
      cause as a fact, and its probe ran before the event that the cause
      names.
    - The split item and `plans/follow-ups/serve-watch-candidate-plan-cost.md`
      described the same step with no **Related** line between them.
    - Two flaky-test records kept causes that their new occurrences
      contradicted.
    - A new decision item, `plans/follow-ups/mokly-production-expect-rule.md`,
      named `plans/follow-ups/record-release-expect.md`, whose fix waits for
      its answer, but the release item kept an action that applied its fix.
    - `plans/follow-ups/serve-pass-rereads-unchanged-pages.md` and
      `plans/follow-ups/follow-up-effort-grade-mismatch.md` kept facts of
      other items that the change replaced: a ranking that had already
      happened, and a grade that had changed.
  - Earlier cases: on 2026-11-22 the split item missed the cuts of its own
    branch, and
    [experiment-records-related-lines.md](./experiment-records-related-lines.md)
    records missing **Related** lines.
  - On 2026-11-24, #488 added the scores of the Canvas site to
    [flaky-site-lighthouse-performance.md](./flaky-site-lighthouse-performance.md)
    and set a temporary 0.9 threshold. Option B kept its six-route audit
    count of 36, option C kept a six-route cap table without `/pricing/`, and
    options A, B, C, and E kept claims about the removed home frame. None of
    them said that a miss that repeats in each audit fails it. The review of
    the branch `calummoore/ci-fix-site-lighthouse-hn4n` found the case. Its
    own correction then wrote expected outcomes as measured ones, and claimed
    that a CSS reader gives selectors before a probe showed it, so a second
    review round corrected both.
- **Problem:** A change that adds facts to an item can leave its other fields,
  its causes, and its links out of date, and no rule asks the writer to check
  them.
- **Impact if no action:** Each review of an item change finds these gaps
  again, and a later branch can start from a field that the item's own facts
  contradict.
- **Root question:** How does a change that adds facts to a follow-up item
  keep every field, cause, and link of that item true?
- **Options:**
  - **A.** Change nothing. Each review finds the gaps when it reads the item.
    Effort: Small.
  - **B.** Add a rule to "Keeping an item current": a change that adds a fact
    to an item re-checks every field of the item against it, searches for the
    item that owns the same problem and gives both items a **Related** line,
    re-checks each item that names the changed item or waits for it, and
    calls a cause suspected, with the result that would confirm or reject it,
    until a test, a run, or a read of the code shows it. Effort: Small.
- **Left out:** A check over item text, because the `testing` skill says
  plans never get a test apart from the link check.
- **Wider fix:** B.
- **Previous examples:** On 2026-11-22,
  `plans/follow-ups/serve-edit-background-pass-split.md` missed the cuts of
  its own branch, and
  [experiment-records-related-lines.md](./experiment-records-related-lines.md)
  records missing **Related** lines.
- **Related:**
  - [follow-up-code-lists-go-stale.md](./follow-up-code-lists-go-stale.md):
    another rule for "Keeping an item current", for lists of code places. The
    two can change the skill in one pull request.
  - [experiment-records-related-lines.md](./experiment-records-related-lines.md):
    an earlier case of the missing **Related** lines.
  - [follow-up-template-workspace-rule.md](./follow-up-template-workspace-rule.md):
    another rule for the shared `plans` skill from the same reviews.
- **Recommendation:** B. One rule covers every case of the reviews of one
  change.
- **Action:** ask the user, because B changes the shared skills of every
  repository that uses them.
