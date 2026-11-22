# Follow-up lists of code places go stale

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-11-21, from `calummoore/mokly-cheaper-sidecar-describe-dlz0`,
  review round 1: the wider fix of finding 2.
- **Location:** `skills/plans/references/follow-up-items.md`, section "Keeping
  an item current", in the `Firna-AI/skills` repository.
- **Reason:** The fix is a new rule in the shared `plans` skill, which changes
  the instructions of every repository that uses the skills, so the user
  decides.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Follow-up item:** one Markdown file under `plans/follow-ups/` that
    records work for after a merge. It must hold every fact that its work
    needs.
- **Background:**
  - Some items list every place in the code where a pattern occurs, such as
    each import of a slow module. Their work is only right when the list is
    complete.
  - The `plans` skill updates an item when a change replaces a decision or
    edits a protocol section. The `git-commit` skill updates references when a
    change removes or renames a thing. No rule updates an item when a change
    adds a new place of a listed pattern.
  - Example: `plans/follow-ups/sidecar-boot-and-encoding.md` lists the
    modules that load the Babel parser when a sidecar starts. Pull request
    #413 added a parser import in `packages/mokly/src/sidecar/pnp-json.ts:3`
    on 2026-11-20, and the item did not name it. The review of 2026-11-21
    found the gap, and that branch added the pattern and a `grep` command to
    the item.
- **Problem:** An item that lists the places of a code pattern goes stale when
  a later change adds a new place.
- **Impact if no action:** A reader who fixes only the listed places misses
  the new ones and gets less gain than the item says.
- **Root question:** How does an item that covers every place of a code
  pattern stay complete when later changes add places?
- **Options:**
  - **A.** Change nothing. Each review finds gaps when it reads an item.
    Effort: Small.
  - **B.** Add a rule to "Keeping an item current" in the shared `plans`
    skill: an item that covers every place of a code pattern gives the
    pattern and the command that lists the places, next to the list.
    Effort: Small.
- **Left out:** A check that resolves each code pointer under `plans/`,
  because it cannot see a missing pointer. A test over item text, because the
  `testing` skill says plans never get a test.
- **Wider fix:** B. It lets each reader find the current places.
- **Previous examples:** `plans/follow-ups/sidecar-boot-and-encoding.md`
  missed `pnp-json.ts:3` after #413.
- **Related:**
  - `plans/follow-ups/follow-up-effort-grade-mismatch.md`: another rule for the
    shared `plans` skill from the same review. The two can change the skill in
    one pull request.
  - [item-fields-after-added-facts.md](./item-fields-after-added-facts.md):
    another rule for "Keeping an item current", for the fields, causes, and
    links of an item when a change adds facts to it.
- **Recommendation:** B. One sentence keeps such lists checkable.
- **Action:** ask the user, because B changes the shared skills of every
  repository that uses them.
