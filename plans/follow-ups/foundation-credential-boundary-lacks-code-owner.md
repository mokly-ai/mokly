# No code owner guards the foundation credential boundary

- **Severity:** Medium (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the outside-the-scope list of the first two reviews of [PR #54](https://github.com/mokly-ai/mokly-cloud/pull/54), kept in the deleted `plans/foundation-terraform-from-ci.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `.github/CODEOWNERS`, which does not exist, and `docs/protocol/foundation-promotion.md:56-58`.
- **Reason:** Each option either adds a merge gate or depends on who maintains the repository, and only the user can choose that.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. No `CODEOWNERS` file exists. The review settings of the `main` branch protection could not be read.
- **Category:** Security (estimate).

- **Terms:**
  - **Foundation identity:** The service account `mkc-github-foundation`, which applies the foundation Terraform root and can change project IAM.
  - **Code owner:** A GitHub user or team that a `CODEOWNERS` file names for a path, so that GitHub requests its review of each change to that path.
  - **Credential boundary:** The files and settings that decide which code can act as an identity.
- **Background:**
  - The foundation identity can change project IAM, so it is owner-equivalent inside the project.
  - `docs/protocol/foundation-promotion.md:56-58` says that main-branch protection and the Foundation workflow file are part of its credential boundary.
  - Only `.github/workflows/foundation.yml` on `main` can assume the identity. That workflow runs scripts from `infra/scripts/`, such as `terraform-foundation.sh`, `terraform-root.sh`, `terraform-plan-policy.py` and `credential-gate.sh`.
  - The repository has no `CODEOWNERS` file at `.github/CODEOWNERS`, `CODEOWNERS` or `docs/CODEOWNERS`. The Git history shows that it never had one.
  - On 2026-10-30, every human commit in the Git history has the same author.
- **Problem:** No rule makes a named reviewer see a change to the Foundation workflow or to the scripts that it runs. Such a change acts with owner-equivalent access after one merge.
- **Impact if no action:** A mistaken or hostile change to these files gets the same review as any other change. After its merge, it acts as the foundation identity.
- **Root question:** Who must review a change that can act as the foundation identity before it merges?
- **Options:**
  - **A.** Change nothing. Main-branch protection and the normal review of each pull request stay the guard. Effort: Small (estimate).
  - **B.** Add `.github/CODEOWNERS` that names a code owner for `.github/workflows/foundation.yml` and `infra/scripts/`. GitHub then requests that review, but it does not block a merge. Effort: Medium (estimate).
  - **C.** Add the same file, and turn on "Require review from Code Owners" in the branch protection of `main`. A change to these paths then needs the approval of a code owner. GitHub does not let an author approve their own pull request, so one maintainer needs an administrator bypass for each such change. Effort: Medium (estimate).
- **Left out:** A required status check that fails on each change to these paths. It adds a gate but no reviewer, so C is better on every point.
- **Wider fix:** C. It is the only option that enforces a named review of every listed path.
- **Previous examples:** None found.
- **Recommendation:** B. It names the owner of the boundary at no merge cost, and it starts to work when a second maintainer joins. C best protects the boundary once the repository has a second maintainer.
- **Action:** ask the user, because condition 4 holds: the value of B and C depends on who maintains the repository, and C adds a merge gate.

The reviews gave no severity, effort, options, recommendation or action. Those judgments and all options were added on 2026-10-30, and they are estimates. On 2026-10-31 the branch protection API of `main` answered HTTP 403, "Resource not accessible by integration". The ruleset list showed an active `Require CI on main` rule. So the review settings of `main` are unknown, and this item does not claim that `main` has no review rule. Check them before you choose C, because C needs administrator access, and a setting that blocks bypasses would stop every such merge.

Source: [the outside-the-scope list](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L461-L463) of the deleted plan.
