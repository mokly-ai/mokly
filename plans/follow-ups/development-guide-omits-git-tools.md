# The development guide omits the Git tools

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from the branch `calummoore/improve-user-onboarding-experience-4ik4`, from the `Outside the scope` list of its first review.
- **Location:** `docs/development/README.md:3-12`, which lists the development tools; `crates/mokly-git/tests/lfs_tests.rs`, `crates/mokly-git/tests/promisor_tests.rs`, `crates/mokly-git/tests/checkout_tests.rs`, `crates/mokly-compare/tests/filter_resource_tests.rs`, and `crates/mokly-cli/tests/changes_failures_tests.rs`, which hold the failing tests.
- **Reason:** The branch that found it changes only the npm `engines` range, and the failures also happen on unchanged `main`.

- **Terms:**
  - **Complete gate:** `cargo xtask check`, which runs every suite, including `cargo test --workspace`.
  - **Promisor remote:** the remote of a partial (blobless) clone, from which Git fetches missing objects on demand.
- **Background:** `docs/development/README.md` lists the tools for repository development: the Node version in `.nvmrc`, npm 11.21.0, Bun, the pinned Rust toolchain, and Chromium. It does not name Git LFS or a minimum Git version. Several Rust tests run real Git commands against fixture repositories, including LFS checkouts and partial clones.
- **Problem:** On a cloud machine with Git 2.43.0 and no `git-lfs`, six Rust tests fail on unchanged `main` at commit `86b7d5765`, so the complete gate fails before it reaches the later suites:
  - `base_reads_smudge_local_lfs_objects` and `missing_lfs_content_downloads_from_the_local_remote` fail with `["lfs", "install", "--local"]: git: 'lfs' is not a git command.`
  - `lfs_checkout_bytes_equal_the_working_resource` fails with `assertion failed: installed.status.success()` at `crates/mokly-compare/tests/filter_resource_tests.rs:93`.
  - `blobless_clone_fetches_missing_base_blobs_in_one_batch` and `failed_promisor_fetch_names_recovery_command` fail with `warning: lazy fetching disabled; some objects may not be available` and `fatal: could not fetch {object} from promisor remote`. No `GIT_NO_LAZY_FETCH` variable was set, so the Git version is the suspected cause. Nobody confirmed the minimum version.
  - `a_missing_historical_blob_is_git_failed_instead_of_unavailable_validation` fails at `crates/mokly-cli/tests/changes_failures_tests.rs:181` because the message is `Git exited with status 128: fatal: bad object …` and does not contain `base object` or `git fetch origin`. The Git version is the suspected cause.
- **Impact if no action:** A contributor or an agent on such a machine cannot pass the complete gate locally, and the failures do not say which tool to install.
- **Root question:** How does a contributor learn, before the gate fails, which Git tools the Rust tests need?
- **Options:**
  - **A.** Name Git LFS and the minimum Git version in the tool list of `docs/development/README.md`, after finding the version that passes the three tests that do not need LFS. Effort: Small.
  - **B.** A plus a check at the start of `cargo xtask check` that fails with an install hint when `git lfs version` fails or Git is older than the minimum, as the gate already does for a wrong Bun version. Effort: Small.
- **Left out:** Skipping the tests when the tools are missing, because the gate would then pass without testing the LFS and partial-clone behaviour.
- **Wider fix:** B, because the gate then names the missing tool for every contributor.
- **Previous examples:** The Bun version check of the required type check, described in `docs/development/README.md`.
- **Related:** None.
- **Recommendation:** B. It turns six confusing failures into one install hint.
- **Action:** fix after merge, apply B, because the problem is outside the scope of the branch that found it.
