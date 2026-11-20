# Follow-ups name the skills repository two ways

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the branch `calummoore/mokly-classify-memo`, a problem that its second review listed outside the scope.
- **Location:** `plans/follow-ups/follow-up-list-approval-state.md`, `plans/follow-ups/result-adapter-helper-functions.md`, `plans/follow-ups/review-missed-tick-rule.md`, and `AGENTS.md` (the `Shared skills` paragraph).
- **Reason:** The names are in follow-up items that other branches added, and that branch changes no shared rule.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Shared skills repository:** the repository of the agent skills that `AGENTS.md` tells agents to read, such as `rust` and `testing`.
- **Background:**
  - `AGENTS.md` says that the shared skills come from `Firna-AI/skills`. The Git remote of that repository is `https://github.com/Firna-AI/skills.git`.
  - Three follow-up items of other branches name it `futex-ai/skills`. The skills repository describes itself as `futex-ai/skills` in its own agent guide.
  - No rule says which name is current.
- **Problem:** A reader of those follow-up items can look for the shared skills under a name that `AGENTS.md` does not use.
- **Impact if no action:** Agents can lose time, or open a pull request against the wrong repository name, when they act on those items.
- **Root question:** Which name do the documents of this repository use for the shared skills repository?
- **Options:**
  - **A.** Change the three follow-up items to `Firna-AI/skills`, the name of `AGENTS.md` and of the Git remote. Effort: Small.
  - **B.** Do A, and ask the owners of the skills repository to make its own agent guide use the same name. Effort: Small.
- **Left out:** A test or a lint of the name, because the `testing` skill gives no test to doc prose, and a new gate needs the user.
- **Wider fix:** None. One fix of the names closes the class, and `AGENTS.md` already states the name.
- **Previous examples:** The three items of the **Location** line.
- **Recommendation:** B. The documents of both repositories then agree.
- **Action:** fix after merge, apply B, because the items belong to other branches, and the skills repository is outside this repository.
