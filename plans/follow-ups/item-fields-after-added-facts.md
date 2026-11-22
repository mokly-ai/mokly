# Added facts leave item fields out of date

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from round 4 of the review of the branch
  `calummoore/mokly-edit-background-render-olos`: the wider fix of findings
  11, 12, 14, 15, and 16.
- **Location:** `skills/plans/references/follow-up-items.md`, the sections
  "Writing an item" and "Keeping an item current", in the `Firna-AI/skills`
  repository.
- **Reason:** The fix is a new rule in the shared `plans` skill, which changes
  the instructions of every repository that uses the skills, so the user
  decides.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Follow-up item:** one Markdown file under `plans/follow-ups/` that
    records work for after a merge. It must hold every fact that its work
    needs, for a reader who has only the repository.
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
    of a reverted speed change to six items. Its review found five cases of
    the class:
    - The split item kept a Recommendation, an Impact, a Kind, and a
      Background rule that the new facts contradicted (finding 11).
    - Three items described reverted code as live, and named methods that the
      revert removed (finding 12).
    - The allocator item stated an unproven cause as a fact, and its probe ran
      before the event that the cause names (finding 14).
    - The split item and `plans/follow-ups/serve-watch-candidate-plan-cost.md`
      described the same step with no **Related** line between them
      (finding 15).
    - Two flaky-test records kept causes that their new occurrences
      contradicted (finding 16).
  - Earlier cases: finding 7 of the same branch, a split item that missed the
    cuts of its own branch, and
    [experiment-records-related-lines.md](./experiment-records-related-lines.md),
    records with missing **Related** lines.
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
    and calls a cause suspected, with the result that would confirm or reject
    it, until a test, a run, or a read of the code shows it. Effort: Small.
- **Left out:** A check over item text, because the `testing` skill says
  plans never get a test apart from the link check.
- **Wider fix:** B.
- **Previous examples:** Finding 7 of the branch
  `calummoore/mokly-edit-background-render-olos`, and
  [experiment-records-related-lines.md](./experiment-records-related-lines.md).
- **Related:**
  - [follow-up-code-lists-go-stale.md](./follow-up-code-lists-go-stale.md):
    another rule for "Keeping an item current", for lists of code places. The
    two can change the skill in one pull request.
  - [experiment-records-related-lines.md](./experiment-records-related-lines.md):
    an earlier case of the missing **Related** lines.
- **Recommendation:** B. One rule covers the five cases of one review.
- **Action:** ask the user, because B changes the shared skills of every
  repository that uses them.
