# GitHub policy log string says organization

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from [PR #77](https://github.com/mokly-ai/mokly-cloud/pull/77), review finding 4.
- **Location:** `crates/mkc-api/src/github/policy.rs:25`.
- **Reason:** PR #77 left this code-structure choice for Cal, and no user answer is recorded.
- **Checked:** 2026-10-31, at commit `f568853e`. The diagnostic still says "read GitHub organization membership". The verified text remains current, and the choice remains pending.
- **Category:** Code structure.

- **Terms:**
  - **`mkc-api`:** The Rust crate that serves the product API, which PR #77 renamed as a whole from the term organization to workspace.
  - **GitHub service:** The `mkc-api` module under `src/github/` that runs the GitHub App installation and sign-in flows.
  - **Error context:** The text that `.context(...)` attaches to a failed store query, which appears in API logs and not in responses.
- **Background:** `workspace_role` in the GitHub service reads the workspace's membership rows to find the caller's role. PR #77 renamed the function and its parameter from `organization_role` and `organization`. The error context on the membership query kept the text "read GitHub organization membership". The PR #77 rename keeps "GitHub organization" only where GitHub's account kind is meant. This query reads Mokly's membership table, not a GitHub organization.
- **Problem:** The context string uses the old product term for a workspace read. After the rename, a reader of the log takes it for a GitHub organization lookup.
- **Impact if no action:** A log line during a failed GitHub flow names the wrong entity. Nothing else changes.
- **Root question:** How does each log text of the API name the entity that its query reads?
- **Options:**
  - **A.** Change the string to "read workspace membership". Cost: one line. Effort: Small.
  - **B.** Option A, and a gate check that rejects the bare word "organization" in `crates/mkc-api` string literals outside the store and GitHub names. Cost: a new check, which the review-fix rule blocks. Effort: Medium.
  - **C.** Option A now, and in a separate branch one `member_role(queries, workspace, actor)` helper in `crates/mkc-api`. The six copies of the membership lookup that the PR #77 review counted call it, with one context text. Cost: a new module and seven files. Effort: Large.
- **Left out:** Not recorded.
- **Wider fix:** C is the structural option (estimate), because one helper holds the one context text. B is a detection fix. PR #77 left A, B and C for the user. None has a recorded answer.
- **Previous examples:** None found in the commit history. The store crates keep the old wording on purpose, for example `"read organizations"` at `crates/mkc-store-pg/src/organization.rs:71`. PR #77 decided that the persistence layer keeps the organization names. The PR #77 review found no other case in the string literals of `crates/mkc-api/src`.
- **Recommendation:** A. One word completes the rename inside the crate boundary that PR #77 set.
- **Action:** ask the user, because condition 6 holds for this internal code-structure choice. PR #77 left it for Cal, and no answer is recorded. A, B and C remain proposals.
