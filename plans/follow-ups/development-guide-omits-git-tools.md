# The gate does not check the Git tools

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-17, from the branch `calummoore/improve-user-onboarding-experience-4ik4`, from the `Outside the scope` list of its first review.
- **Location:** `xtask/src/check/commands.rs:44` to line 67, which lists the checks of the Repository suite and runs the Rust tests at line 65; `xtask/src/check/commands.rs:21` to line 31, which lists the checks of the Native suite and runs the Rust tests at line 30; `docs/protocol/ci-verification.md:5` to line 7, which says that the local gate starts with the live workspace dependency audit; `docs/protocol/ci-verification-repository.md:7` to line 25, which lists the checks of the Repository suite in order; `docs/development/README.md:3` to line 19, which names the Git tools.
- **Reason:** Option B adds a new failure to the gate, and only the user can approve a new gate failure.

- **Terms:**
  - **Complete gate:** `cargo xtask check`, which runs the local suites in order: Repository, Viewer, and Browser. The Repository suite runs `cargo test --locked --workspace` after its earlier checks, such as the audits, the lints, and the package builds.
  - **Promisor remote:** the remote of a partial (blobless) clone, from which Git fetches missing objects on demand.
  - **Lazy-fetch control:** the environment variable `GIT_NO_LAZY_FETCH=1`, which `crates/mokly-git/src/system_command.rs` sets for each Git command of Mokly.
- **Background:**
  - Several Rust tests run real Git commands against fixture repositories, including Git LFS checkouts and partial clones. The gate checks no Git tool before its suites run.
  - Option A is done. On 2026-11-19, the branch `calummoore/fu-development-guide-git-tools-np08` changed `docs/development/README.md`:
    - The tool list names "Git 2.45.0 or later and Git LFS for the Rust tests".
    - A new paragraph says that the tests that read Git LFS files need the `git lfs` command. It says that the tests that read partial clones or missing objects need Git 2.45.0 or later, and that they fail with the Git 2.43.0 package of Ubuntu 24.04.
    - The paragraph says that the test errors do not give the required Git version or a Git LFS install hint. It tells the reader to run `git --version` and `git lfs version` before `cargo xtask check`.
  - The history of this item:
    - The first version, of 2026-11-17, had the title "The development guide omits the Git tools". It had the kind Outside the scope, the grade Confidence Medium, and `Action: fix after merge, apply B`. Its reason was "The branch that found it changes only the npm `engines` range, and the failures also happen on unchanged `main`."
    - Option B adds a new gate failure. The always-on rules, and the outcome rules of the `decisions-and-findings` skill, reserve a new gate failure for the user. B also changes a requirement in a protocol doc of the location: the start of the gate, or the ordered checks of the Repository suite.
    - So B waits for the user. The first version did not apply these rules when it gave `fix after merge, apply B`.
    - On 2026-11-19, the user asked for this split: apply A in the branch above, and keep B in this item as an open decision.
  - The evidence of 2026-11-17 came from `main` at commit `86b7d5765`, on a cloud machine with Git 2.43.0 and no `git-lfs`. Six Rust tests failed, so the complete gate failed before it reached the later suites:
    - `base_reads_smudge_local_lfs_objects`, at `crates/mokly-git/tests/checkout_tests.rs:45`, and `missing_lfs_content_downloads_from_the_local_remote`, at `crates/mokly-git/tests/lfs_tests.rs:15`, failed with `["lfs", "install", "--local"]: git: 'lfs' is not a git command.`
    - `lfs_checkout_bytes_equal_the_working_resource` failed with `assertion failed: installed.status.success()` at `crates/mokly-compare/tests/filter_resource_tests.rs:93`.
    - `blobless_clone_fetches_missing_base_blobs_in_one_batch` and `failed_promisor_fetch_names_recovery_command`, at `crates/mokly-git/tests/promisor_tests.rs:22` and line 117, failed with `warning: lazy fetching disabled; some objects may not be available` and `fatal: could not fetch {object} from promisor remote`.
    - `a_missing_historical_blob_is_git_failed_instead_of_unavailable_validation` failed at `crates/mokly-cli/tests/changes_failures_tests.rs:181`. Its message was `Git exited with status 128: fatal: bad object …`, without `base object` or `git fetch origin`.
    - The first version noted that the environment set no `GIT_NO_LAZY_FETCH` variable, and it suspected the Git version. Mokly sets the variable itself, as the lazy-fetch control term says.
  - The evidence of 2026-11-19 came from `main` at commit `f4f0082fd`:
    - Each run put one Git first on `PATH`. The built versions came from the kernel.org source tarballs. Their SHA-256 sums matched the signed `sha256sums.asc` of kernel.org. Git LFS 3.4.1 was installed, and the five npm packages were built.
    - Each built version used `make prefix={folder} sysconfdir=/etc NO_GETTEXT=YesPlease NO_TCLTK=YesPlease NO_CURL=YesPlease NO_PYTHON=YesPlease install`.
    - The commands were:

      ```bash
      cargo test --locked -p mokly-git --test promisor_tests -- --exact blobless_clone_fetches_missing_base_blobs_in_one_batch failed_promisor_fetch_names_recovery_command
      cargo test --locked -p mokly-cli --test changes_failures_tests -- --exact a_missing_historical_blob_is_git_failed_instead_of_unavailable_validation
      ```

    - The results:

      | Git    | Origin                                                   | The two promisor tests | The missing-blob test |
      | ------ | -------------------------------------------------------- | ---------------------- | --------------------- |
      | 2.43.0 | `/usr/bin/git`, the Ubuntu package `1:2.43.0-1ubuntu7.4` | Fail                   | Fail                  |
      | 2.44.4 | Built from source                                        | Fail                   | Fail                  |
      | 2.45.0 | Built from source                                        | Pass                   | Pass                  |
      | 2.50.1 | Built from source                                        | Pass                   | Pass                  |

    - The promisor tests ran twice with each Git, and the missing-blob test ran once. Each run gave the result of the table.
    - On 2.43.0 and 2.44.4, the promisor tests stopped at `promisor_tests.rs:81` and line 155. Git exited with status 128, with the warning and the fatal text of 2026-11-17. The missing-blob test stopped at line 181 with `[mokly/git-failed] comparison against base ref "fixture-base" failed: base {commit}: Git exited with status 128: fatal: bad object {blob}`.
    - Without the npm package builds, the missing-blob test stops earlier with `[mokly/server-failed] Build or reinstall the matching @mokly/viewer package and retry.`
    - The Git source explains the boundary. In Git 2.45.0, `environment.c` turns `GIT_NO_LAZY_FETCH=1` into `fetch_if_missing = 0` for every command. Git 2.44.4 reads the variable only in the promisor fetch of `promisor-remote.c`. That fetch refuses with the warning above, and the command then dies with `could not fetch {object} from promisor remote`.
    - In Git 2.45.0, `get_reference` in `revision.c` records a missing start point under `rev-list --missing=print`. Git 2.44.4 dies there with `bad object {object}`. The Git 2.45.0 release notes name both features: the `--no-lazy-fetch` option, and missing start points under `rev-list --missing=print`.
    - The three Git LFS tests were not part of these runs.
  - The gate already checks one tool. The required type check, `npm run typecheck:ci`, fails when the `bun` on the PATH is not the exact version in `.bun-version`. `npm run typecheck:fast` instead prints a warning with the install command and runs the standard check.
  - CI runs the Rust tests in the Repository job on Linux and in the Native jobs on macOS and Windows. All three jobs passed on `main` at `f4f0082fd`, in the CI run of 2026-11-19. So the GitHub-hosted runners have Git LFS and a Git that passes these tests.
  - On 2026-11-20, the missing-base-object fix made the two promisor tests and the missing-historical-blob test pass on Git 2.43.0 and 2.45.0. The development requirement stays Git 2.45.0 or later and Git LFS. This item retains the development-tool preflight decision.
- **Problem:** The gate does not check the development Git version or Git LFS before the Rust tests. Without `git-lfs`, three Rust tests fail after the earlier checks. Their errors give no Git LFS install hint. A Git older than the development requirement also gets no early version hint.
- **Impact if no action:** A contributor without Git LFS must find the cause of three failures after the earlier checks. A contributor with an unsupported development Git gets no early hint. The guide already names the tools.
- **Root question:** How does a contributor learn, before the gate fails, which Git tools the Rust tests need?
- **Options:**
  - **A.** Name Git LFS and the minimum Git version in the tool list of `docs/development/README.md`, after finding the version that passes the three tests that do not need LFS. Effort: Small.
    - Applied on 2026-11-19, with the minimum 2.45.0, as the background says. To choose A now is to change nothing more.
  - **B.** A plus a check at the start of `cargo xtask check` that fails with an install hint when `git lfs version` fails or Git is older than the minimum, as the gate already does for a wrong Bun version. Effort: Small.
    - The minimum is 2.45.0.
    - The check adds a new gate failure. It also changes the start of the gate in `docs/protocol/ci-verification.md`, or the ordered list in `docs/protocol/ci-verification-repository.md`. The tool list of `docs/development/README.md` then names the check.
    - The check must run where the Rust tests run: in the Repository and Native suites, also on remote Testboxes.
    - It must read the version text of each platform, such as `git version 2.45.0.windows.1`. A version number does not show a backported build. A probe of the two Git behaviours avoids that, at a higher cost.
  - **C.** A plus the same check at the start of `cargo xtask check`, but the check prints a warning with the install hint and the gate continues. Effort: Small.
    - It adds no gate failure. It works like `npm run typecheck:fast`, which warns with the install command and continues.
    - It still changes the start of the gate in `docs/protocol/ci-verification.md`, which is a requirement.
    - Missing Git LFS still fails at the Rust tests. The warning can scroll out of view before they fail.
- **Left out:**
  - Skipping the tests when the tools are missing, because the gate would then pass without testing the LFS and partial-clone behaviour.
  - An install hint in individual Rust test errors, because the hint then comes only after the earlier checks. It fails the goal of an early hint. It can still go with B or C.
  - A separate command that checks the tools, because a contributor must know to run it. It reaches the same readers as A, and A already gives the two check commands.
- **Wider fix:** B, because the gate then names the missing tool for every contributor.
- **Previous examples:** The Bun version check of the required type check, `runRequiredTypecheck` in `scripts/verification/typecheck-ci-runner.mjs`, described in `docs/development/README.md`. For C, the warning of `runFastTypecheck` in `scripts/verification/typecheck-fast-runner.mjs`.
- **Related:** None.
- **Recommendation:** B. It names missing Git LFS or an unsupported development Git version before the long checks. C is the best option that adds no gate failure.
- **Action:** ask the user, because option B adds a new gate failure, and only the user can approve one. On 2026-11-19 the user also asked to decide B.
