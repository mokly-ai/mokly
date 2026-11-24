# Follow-up template omits the workspace rule

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from round 5 of the review of the branch
  `calummoore/mokly-edit-background-render-olos`: the wider fix of finding 19.
- **Location:** `skills/plans/templates/follow-up.md`, the placeholder of the
  body and of the **Reason**, in the `Firna-AI/skills` repository.
- **Reason:** The fix changes the shared `plans` skill, which every repository
  that uses the skills reads, so the user decides.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Follow-up item:** one Markdown file under `plans/follow-ups/` that holds
    every fact of work that waits until after a merge.
- **Background:**
  - "Writing an item" in `references/follow-up-items.md` of the `plans` skill
    says that an item does not depend on a chat or another workspace, and
    that its body uses no number that only another document explains.
  - The placeholder of the body in `templates/follow-up.md` lists a plan, a
    review report, a findings file, `.context/`, a pull request, and a link,
    but not a chat or another workspace. Writers fill the template field by
    field.
  - On 2026-11-22 a new item of the branch
    `calummoore/mokly-edit-background-render-olos`,
    `plans/follow-ups/core-rss-retained-free-pages.md`, waited for "workspace
    243" in its **Reason** and its **Action**. The review of that branch found
    it, and the branch replaced the number with the dated choice and the
    branch name.
- **Problem:** The template does not state a rule that the skill states, at
  the field where writers break it.
- **Impact if no action:** New items keep depending on workspaces that a
  reader with only the repository cannot find.
- **Root question:** How does the template stop an item from depending on a
  chat or another workspace?
- **Options:**
  - **A.** Change nothing. Each review finds the dependency. Effort: Small.
  - **B.** Add "a chat, or another workspace" to the body placeholder of the
    template, and say in the **Reason** placeholder that the fact must be in
    the repository or in the item. Effort: Small.
- **Left out:** A check over item text, because the `testing` skill says
  plans never get a test apart from the link check.
- **Wider fix:** B.
- **Previous examples:** `plans/follow-ups/prepare-only-describe.md` and
  `plans/follow-ups/light-sidecar-entry.md` name workspace numbers in their
  bodies.
- **Related:**
  [item-fields-after-added-facts.md](./item-fields-after-added-facts.md):
  another rule for the shared `plans` skill from the same reviews. The two can
  change the skill in one pull request.
- **Recommendation:** B. One phrase makes the template match the rule.
- **Action:** ask the user, because B changes the shared skills of every
  repository that uses them.
