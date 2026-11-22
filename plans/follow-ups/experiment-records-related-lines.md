# Older experiment records do not link the kind item

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from round 4 of the review of the branch
  `calummoore/mokly-earlier-postcss-start-bdhv`, whose finding check listed
  it outside the scope.
- **Location:** `plans/follow-ups/serve-head-generation-preload.md`,
  `plans/follow-ups/serve-postcompile-import-proof-cost.md`,
  `plans/follow-ups/serve-watch-candidate-plan-cost.md`, and
  `plans/follow-ups/serve-edit-bundle-split.md`: the **Related** line of
  each record.
- **Reason:** The four records are outside the diff that found the gap, so a
  separate change adds the links.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Experiment record:** a follow-up item of the kind "Closed experiment
    record". It keeps the measurements and the rejected options of a speed
    experiment that stopped.
  - **Kind item:** `plans/follow-ups/closed-experiment-record-kind.md`, which
    waits for the user on the kind and the home of the experiment records.
- **Background:**
  - "Writing an item" in `references/follow-up-items.md` of the shared
    `plans` skill says that two linked items that stay apart each get a
    **Related** line.
  - The kind item names five records in its **Location**. Its answer applies
    to each of them.
  - `plans/follow-ups/light-sidecar-entry.md` links the kind item in its
    **Related** list. The four older records do not.
- **Problem:** The four older records do not say that their kind and their
  home wait for an open decision.
- **Impact if no action:** A reader of one of these records does not learn
  that it may move or change its kind, and can copy its unlisted kind into a
  new record.
- **Root question:** How does each experiment record point to the open
  decision about its kind and its home?
- **Options:**
  - **A.** Add one **Related** bullet to each of the four records that links
    the kind item, with the words of the bullet in
    `plans/follow-ups/light-sidecar-entry.md`. Effort: Small.
- **Left out:** Change nothing: it fails the goal, because four records stay
  without the link. Only one approach is real, because the `plans` skill
  gives the form of the link.
- **Wider fix:** None. Option A of the kind item, a listed kind in the shared
  `plans` skill, removes the need for the links, and it waits for the user.
- **Previous examples:** None found.
- **Recommendation:** A. It applies the rule of the `plans` skill with four
  bullets.
- **Action:** fix after merge, apply A, because the records are outside the
  diff that found the gap, and the answer to the kind item can make the
  links unnecessary.
