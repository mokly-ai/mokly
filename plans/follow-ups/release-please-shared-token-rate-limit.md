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
  - `docs/protocol/npm-release-management.md` prefers a repository-owned fine-grained token or a GitHub App credential in `RELEASE_PLEASE_TOKEN`. `.github/workflows/release.yml:45` passes the stored secret straight to the action. A GitHub App installation token expires after one hour, so in that secret only a long-lived token works.
  - The secret now holds a credential of the user `calummoore`, GitHub user ID 4988117. The agent workspaces of the repository use the same account, and all of them share its 5,000-point GraphQL limit per hour.
  - From 2026-11-25 12:00 UTC to 22:30 UTC, 3 of 20 Release runs on `main` failed in this step: runs 45632486702 and 45636465245 with `release-please failed: Request failed due to following response errors: - API rate limit already exceeded for user ID 4988117.`, and run 45688809387 with an empty `release-please failed:` message after "Looking for open release pull requests". The next push ran the step again and passed.
- **Problem:** When agents spend the shared GraphQL limit, the Release workflow on `main` fails without a release fault.
- **Impact if no action:** `main` shows failed Release runs now and then. The release pull request stays stale until the next push, and people spend time on red runs that need no fix.
- **Root question:** How does the release step get a GraphQL budget that agent work cannot spend?
- **Options:**
  - **A.** Put a fine-grained token of a dedicated bot account in `RELEASE_PLEASE_TOKEN`. The workflow stays as it is, and the protocol doc already prefers such a token. A maintainer creates the account and rotates the token as `docs/protocol/npm-release-operations.md:31-32` says. Effort: Small.
  - **B.** Use a GitHub App. A new step makes an installation token on each run with `actions/create-github-app-token` and passes it to `release-please`, because an installation token expires after one hour and a stored one fails on later runs. An App client ID and a private key secret replace `RELEASE_PLEASE_TOKEN`. The change updates `docs/protocol/npm-release-management.md:134-138`, `docs/protocol/npm-release-operations.md:31-32`, and the secret list in `docs/ops/repository-cutover.md:99-113`. A maintainer creates and installs the App. Effort: Medium.
  - **C.** Give the agent workspaces their own GitHub account or app token, so that they stop spending the user's limit. It also protects the user's own API use. Effort: Medium.
  - **D.** Remove `RELEASE_PLEASE_TOKEN` and use the `GITHUB_TOKEN` fallback, which has its own limit for each repository. GitHub then does not start the checks of the release pull request, so a maintainer must start them by hand. Effort: Small.
- **Left out:** A retry of the step: the limit stays spent for up to an hour, so a retry inside the run does not help. A GitHub App installation token stored in the secret: it expires after one hour. A scheduled job that refreshes the secret: it needs the App key and a credential that writes secrets, and GitHub can delay scheduled runs.
- **Wider fix:** B, with one token step for each workflow that needs a token that starts checks. `.github/workflows/dependency-audit.yml:31` and `:52` read `DEPENDENCY_AUDIT_TOKEN` in the same way, and `docs/protocol/dependency-audit-update-pr.md:190-206` also accepts an installation token in a stored secret.
- **Previous examples:** None found.
- **Recommendation:** A. It needs no workflow change, follows the token that the protocol doc already prefers, and keeps the checks of the release pull request automatic. B best protects the codebase, because no long-lived token remains.
- **Action:** ask the user, because each option needs a new credential or a changed secret in the GitHub settings, which only a maintainer can make.
