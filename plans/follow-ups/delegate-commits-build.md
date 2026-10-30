# Keep delegated commits buildable

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 130, from finding 7 of the F21 review.
- **Location:** None. The process rule lives in the shared `delegating`
  skill, outside this repository.
- **Reason:** On 2026-10-21 the user deferred the open review items until
  after the merge and kept each choice for a later decision.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Delegated branch:** a branch that another agent writes for one part of
    a plan, and that the coordinator merges into the plan's branch.
- **Background:**
  - On the delegated branch `rebuild/followups-f21`, the `mokly-catalogue`
    crate does not compile from commit `06742270` to commit `c7260846`.
  - One test expects the wrong position until commit `b1cc2dd6`. Two commit
    messages describe their change wrongly.
  - The plan recorded the range as option A suggested.
  - PR #199 merged into `main` as one squash commit, `d935e6a6`. So the
    broken commits are not in the history of `main`. They stay on the
    delegated branch.
- **Problem:** Nothing in the shared process requires each delegated commit
  to build before the handoff.
- **Impact if no action:** A later delegated branch can again hold commits
  that do not build. A bisect or a stacked branch on such a commit fails.
- **Root question:** How does delegated work keep every commit buildable?
- **Options:**
  - **A.** Keep the history, and record the broken range, as this item
    does. Effort: Small.
  - **C.** Require each delegate brief to build every commit before the
    handoff. Effort: Medium (estimate).
- **Left out:** Option B, rewrite the branch so that every commit builds.
  The branch is merged, and `main` holds only the squash commit, so a
  rewrite fixes nothing and cannot protect later work.
- **Wider fix:** C. A handoff rule stops new broken intermediate commits.
- **Previous examples:** Five fix-round commits of the HTML pipeline branch
  did not build: `b9dad262`, `e877ca04`, `a5e7461b`, `62e1e3f7`, and
  `fd3fccba`. On 2026-10-28 the user chose to record that list and
  squash-merge the branch.
- **Recommendation:** A. A merged branch cannot be fixed safely. C best
  protects later branches.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user deferred the open review items past the merge to decide each one
  later.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6043).
