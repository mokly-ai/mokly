# Release Please fails when agents spend its token

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from the branch `calummoore/ci-speed-flaky-follow-ups-b-and-new-k3dt`, the CI history scan of the flaky-test work.
- **Location:** `.github/workflows/release.yml:41-45`, the `release-please` step and its `token`.
- **Reason:** The fix needs a new repository credential in the GitHub settings, which only a maintainer can create.

- **Source:** Implementation.
- **Category:** Process.
- **Terms:**
  - **`RELEASE_PLEASE_TOKEN`:** the repository secret that the `release-please` step of `.github/workflows/release.yml` uses before it falls back to `GITHUB_TOKEN`.
- **Background:**
  - Each push to `main` runs the Release workflow. Its `release-please` step reads the commits and the releases through the GitHub GraphQL API and updates the release pull request.
  - `docs/protocol/npm-release-management.md` prefers a repository-owned fine-grained token or a GitHub App credential in `RELEASE_PLEASE_TOKEN`.
  - The secret now holds a credential of the user `calummoore`, GitHub user ID 4988117. The agent workspaces of the repository use the same account, and all of them share its 5,000-point GraphQL limit per hour.
  - From 2026-11-25 12:00 UTC to 22:30 UTC, 3 of 20 Release runs on `main` failed in this step: runs 45632486702 and 45636465245 with `release-please failed: Request failed due to following response errors: - API rate limit already exceeded for user ID 4988117.`, and run 45688809387 with an empty `release-please failed:` message after "Looking for open release pull requests". The next push ran the step again and passed.
- **Problem:** When agents spend the shared GraphQL limit, the Release workflow on `main` fails without a release fault.
- **Impact if no action:** `main` shows failed Release runs now and then. The release pull request stays stale until the next push, and people spend time on red runs that need no fix.
- **Root question:** How does the release step get a GraphQL budget that agent work cannot spend?
- **Options:**
  - **A.** Put a GitHub App installation token, or a fine-grained token of a bot account, in `RELEASE_PLEASE_TOKEN`. The protocol doc already prefers this. A maintainer creates the app or the account. Effort: Small.
  - **B.** Give the agent workspaces their own GitHub account or app token, so that they stop spending the user's limit. It also protects the user's own API use. Effort: Medium.
  - **C.** Remove `RELEASE_PLEASE_TOKEN` and use the `GITHUB_TOKEN` fallback, which has its own limit for each repository. GitHub then does not start the checks of the release pull request, so a maintainer must start them by hand. Effort: Small.
- **Left out:** A retry of the step: the limit stays spent for up to an hour, so a retry inside the run does not help.
- **Wider fix:** A. A repository-owned credential separates the release from every person and agent.
- **Previous examples:** None found.
- **Recommendation:** A. It follows the credential that the protocol doc already prefers, and it keeps the checks of the release pull request automatic.
- **Action:** ask the user, because each option needs a new credential or a changed secret in the GitHub settings, which only a maintainer can make.
