# Follow-up list hides pending user choices

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-30, from PR #247, the check of finding 3 in review
  round 3.
- **Location:** None in this repository. The work is in the external
  repository `futex-ai/skills`: `skills/plans/templates/follow-up.md:4`,
  `skills/plans/references/follow-up-items.md:10-17` and `:69-73`,
  `skills/plans/scripts/follow-ups.sh:19-23` and `:35-39`,
  `skills/plans/SKILL.md:164-171`, and `tests/follow_ups_test.sh:23-27`.
- **Reason:** The fix changes the shared skill workflow outside Mokly, and
  it needs the user's process choice.

- **Source:** Review.
- **Category:** Process (estimate).
- **Terms:**
  - **Follow-up item:** one file under `plans/follow-ups/` that records work
    that waits until after a merge.
  - **Origin:** where an item came from, for example a review finding, a
    problem outside a review's scope, or a task of a deleted plan.
  - **Approval state:** what the item waits on. Either an agent may do the
    work after the merge, or the user must choose first.
  - **Action:** the last field of an item. `fix after merge, apply {letter}`
    lets a later branch do the work. `ask the user, because {condition}`
    waits for the user.
  - **Listing helper:** `skills/plans/scripts/follow-ups.sh`, which lists the
    open items by severity with their Kind.
- **Background:**
  - Mokly uses the shared skills of `futex-ai/skills`, as `AGENTS.md:15-19`
    says. When this item was added, the installed `plans` skill equalled
    that repository at commit `f846559`. On 2026-10-30 the installed skills
    equal that repository at commit `2bfecb3`. Its template still has the
    same four Kind values.
  - The template's Kind line, `templates/follow-up.md:4`, allows four
    values. Two name an origin: Outside the scope and Post-merge task. Two
    name an approval state: Fix after merge and Needs decision.
  - The review-fix rule gives a problem outside the review scope the full
    item layout, at `skills/implementation-review/references/review-fix-rule.md:219-220`.
    So its Action can be `fix after merge` or `ask the user`.
  - The listing helper reads Severity, Kind, and the title, at lines 27-37.
    It prints `[Kind]` at line 39, and it never reads Action.
    `tests/follow_ups_test.sh:23-27` pins that output.
  - The Action field stays the authority on what an item waits on.
  - An item with Kind Outside the scope can have Action `ask the user`.
    Its list entry shows only `[Outside the scope]`.
  - An item with the same Kind and Action `fix after merge, apply A` shows
    the same tag, although an agent may fix it without the user.
- **Problem:** Kind mixes origin and approval state. The list shows the
  same tag for outside-scope items with different Actions. A reader cannot
  identify their pending user choices from the list.
- **Impact if no action:** A reader who scans the list for Needs decision
  misses pending user choices. Decisions then stay open longer, or an agent
  starts work that waits for the user.
- **Root question:** How can a reader of the follow-up list see which items
  wait for the user's choice?
- **Options:**
  - **A.** Keep the current list. Readers open each item and read its
    Action. Pending choices stay hidden in the list. Effort: Small (estimate).
  - **B.** Keep Kind. Make the listing helper read the outcome of the
    existing Action field, the words before its first comma. Drop an
    "(estimate)" mark, as the helper already does for severity. Print the
    outcome beside the Kind, for example
    `[Outside the scope | ask the user]`. Print only
    the Kind for an item without Action, such as a post-merge task. Update
    the exact output cases of `tests/follow_ups_test.sh`. The change stays
    under 30 lines of the existing helper and adds no file. The list then
    depends on the fixed wording of the Action outcomes, and the template
    keeps the mixed Kind field. Effort: Small (estimate).
  - **C.** Keep one Kind field, and give a pending choice precedence: an item
    whose Action is `ask the user` has Kind Needs decision, whatever its
    origin. Keep the origin in the Added line. Change the wording of the
    template and the reference, and re-mark the existing items. The origin
    then lives only in prose, and Kind still repeats the Action outcome, so
    the two can disagree. Effort: Small (estimate).
  - **D.** Replace Kind with two fields, Origin and Approval state. The
    helper reads Kind while the new fields are absent, so old items still
    list during the move. Update the template, the reference, the `plans`
    skill, the helper, and its tests. Each repository that uses the skill
    then migrates its open items. A shared format change with a migration
    is Large. The new field repeats the Action outcome. Effort: Large (estimate).
- **Left out:**
  - A helper flag that lists only the waiting items. It is a narrower form
    of B, and it hides the rest of the list.
  - A hand-kept index of pending choices. The `plans` skill keeps no index
    file, and an index goes stale.
  - A check that fails an item whose Kind and Action disagree. It adds a
    gate, which needs the user, and it keeps two fields for one fact.
- **Wider fix:** B (estimate). The list then takes the approval state from Action, the
  one field that holds it, so no Kind value can hide it again.
- **Previous examples:**
  - The Mokly migration of commit `0ee5e459` moved 145 items to the current
    layout. 52 of them have Kind Outside the scope, and 29 of those end with
    `ask the user`. The list shows none of those 29 as waiting.
  - In the same migration, several items needed a Kind correction by hand
    to match a dated user choice.
  - The shared template, `templates/follow-up.md:4`, sets the mixed field for
    every repository.
- **Recommendation:** B (estimate). It shows every pending choice at once,
  reads the field that is already the authority, and needs no migration.
  D best separates origin and approval state as data, but it is Large, and
  its new field repeats the Action outcome.
- **Action:** ask the user, because condition 6 holds (estimate): the review-fix rule
  sends every process finding to the user. This one changes a shared skill
  outside Mokly.
