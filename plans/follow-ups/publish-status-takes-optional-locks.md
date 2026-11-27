# Publish runs git status with optional locks

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-17, from the gap list `plans/follow-ups/mokly-upstream-gaps-to-file.md`, which the Mokly 0.18.0 upgrade of the cloud wrote on 2026-11-02 on the branch `calummoore/mokly-cli-upgrade`. The move of Mokly Cloud into this repository split that list into items.
- **Location:** `crates/mokly-publish/src/checkout.rs:81-91` and `:209-223`, `crates/mokly-git/src/system_command.rs:7-37`, and `docs/protocol/mokly-git.md:91`.
- **Reason:** The defect is outside the scope of the change that found it.

- **Source:** Review.
- **Category:** Product bug.
- **Background:**
  - `docs/protocol/mokly-git.md:91` says that no Git command refreshes the index through optional locks.
  - The shared repository command of `crates/mokly-git/src/repository_command.rs:52` adds `--no-optional-locks` to each command that it runs.
  - The checkout check of `mokly publish` runs `git status --porcelain=v1 -z --untracked-files=all --ignore-submodules=none --renames` through its own `run_with_mode`, in `crates/mokly-publish/src/checkout.rs:81-91` and `:209-223`. That path adds no `--no-optional-locks`. `git_command` in `crates/mokly-git/src/system_command.rs:7-37` sets no `GIT_OPTIONAL_LOCKS`.
  - `git status` refreshes the index and rewrites `.git/index` when it can take the lock. The Mokly 0.18.0 upgrade of the cloud saw that rewrite right after a commit.
- **Problem:** `mokly publish` can rewrite `.git/index` through an optional lock, against the Git contract.
- **Impact if no action:** A Git command that runs at the same time in the checkout can fail on the index lock, and a checkout that a tool reads gets a write.
- **Root question:** How does each Git process of Mokly read without an index write?
- **Options:**
  - **A.** Add `--no-optional-locks` to the `git status` call of `crates/mokly-publish/src/checkout.rs`, with a test that the request carries it. Effort: Small.
  - **B.** Run each Git command of the checkout check through the shared repository command of `mokly-git`. Effort: Medium.
  - **C.** Set `GIT_OPTIONAL_LOCKS=0` in `git_command` for every Git process, with a test. Effort: Small.
- **Left out:** None.
- **Wider fix:** C, because every Git process then follows the contract, also a new call.
- **Previous examples:** The shared repository command already adds the option, in `crates/mokly-git/src/repository_command.rs:52`.
- **Related:** `plans/follow-ups/changes-diff-refreshes-index.md`: the same protocol sentence. Git's quiet index refresh of the Changes `git diff` ignores `GIT_OPTIONAL_LOCKS=0`, so option C does not cover that command.
- **Recommendation:** C. One default covers every current and future Git call.
- **Action:** fix after merge, apply C, because the defect is outside the scope of the change that found it.
