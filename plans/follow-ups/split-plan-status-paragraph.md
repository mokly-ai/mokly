# Plan status goes false after an earlier merge

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-31, from the branch
  `conductor/built-repository-packages-in-changes`, review finding 4.
- **Location:** `plans/built-repository-packages.md:3-7`, and the
  "Completion boundary" section and `templates/plan.md` of the shared
  `plans` skill in the `futex-ai/skills` repository.
- **Reason:** It is a process question about plan wording, which always
  waits for the user.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Status paragraph:** the first paragraph below a plan's title. It
    gives the plan state, the branch, and the pull request.
  - **Plan that lands in parts:** a plan whose milestones merge in more than
    one pull request. Each earlier pull request keeps the plan on `main`,
    and the last one deletes it, under the `plans` skill.
- **Background:** `plans/built-repository-packages.md` lands in two pull
  requests. Its status paragraph says that no pull request exists yet. A
  coordinator session opens and merges each pull request. A later milestone
  of the plan records the link and the merge date of the first pull request,
  but that milestone reaches `main` only with the second pull request. The
  `plans` skill tells a plan whose pull request opens early to say
  `[PR #N](url) is open.`, and `plans/ui-package-shell-views.md` on `main`
  shows that this sentence also stays on `main` after its pull request
  merged.
- **Problem:** After the first merge, `main` holds a status paragraph that
  says that no pull request exists, or that one is open. Both are false
  while the second pull request waits for open decisions.
- **Impact if no action:** `scripts/active-plans.sh` and readers of `main`
  see a stale state for a plan that is partly merged.
- **Root question:** How does a plan that lands in more than one pull
  request keep a true status on `main` after each earlier pull request
  merges?
- **Options:**
  - **A.** After the coordinator opens the first pull request, put
    `[PR #N](url) is open.` in the status paragraph, then commit and push
    before the merge. The sentence goes false at the merge. Effort: Small.
  - **B.** Reword the status paragraph now, so that it stays true before,
    during, and after the first merge. It names the milestones of each pull
    request and never says that a pull request is open or not open. The
    squash commit on `main` names the pull request. Effort: Small.
  - **C.** Add a rule to the `plans` skill: each pull request of a plan that
    lands in parts updates the status paragraph before it merges. Effort:
    Small.
  - **D.** Change the `plans` skill for a plan that lands in parts: its
    status paragraph states only facts that stay true on `main`, such as the
    milestones of each pull request, each known link, and each earlier merge
    with its date. Keep "is open" for a plan that its own pull request
    deletes. The change is a pull request in `futex-ai/skills`. Effort:
    Small.
  - **E.** Do A in words that stay true, `[PR #N](url) holds milestones 1 to
2.1.`, and push before the merge. The coordinator must give the number
    and wait for the push, and the push runs the full CI again. Effort:
    Small.
- **Left out:**
  - A check that flags a stale status, because plans never get a test under
    the `testing` skill, and a phrase check misses each new wording.
  - A plan-only pull request after the merge, because `main` shows the
    false text until it merges.
  - A direct commit on `main`, because `main` is protected.
- **Wider fix:** D. A rule that only adds an update before the merge fails
  when the wording goes false at the merge, as the "is open" form does.
- **Previous examples:** `plans/ui-package-shell-views.md` still says "is
  open" on `main` after its pull request merged.
- **Recommendation:** B. It makes the status true across the first merge
  with one edit now, with no pull request number and no extra CI run. D
  best protects every plan that lands in parts.
- **Action:** ask the user, because condition 6 of the decision test holds:
  a process finding always waits for the user.
