# Missing base objects fail on Git 2.43

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the Milestone 7 checks of `plans/combine-mokly-cloud.md`, on the branch `calummoore/combine-mokly-cloud-into-repo-704s`.
- **Location:** `crates/mokly-git/src/fetch.rs`, `ensure_objects`, which sends object ids to `git rev-list --objects --no-object-names --missing=print --stdin`.
- **Reason:** The defect is in Mokly's Git layer, not in the combine, and the combine branch changes no Mokly code.
- **Checked:** 2026-11-18, with Git 2.43.0 on Ubuntu 24.04. The CI images use a newer Git, where the tests pass.
- **Category:** Correctness.

- **Background:**
  - `ensure_objects` lists the objects that a comparison needs and fetches the missing ones from a promisor remote. Mokly sets `GIT_NO_LAZY_FETCH=1`, so Git never fetches an object by itself.
  - The ids that it sends can be blob ids. Git then reads each blob as an input tip of `rev-list`.
- **Problem:**
  - Git 2.43 exits with status 128 when an input tip is missing: `fatal: bad object {id}`. In a blobless clone, Git first tries the disabled lazy fetch: `fatal: could not fetch {id} from promisor remote`. Newer Git prints `?{id}` for the missing tip, and Mokly then fetches it.
  - The same missing blob, reached through its commit, prints `?{id}` on Git 2.43 too.
  - On Git 2.43, Mokly cannot fetch missing base blobs, and its error does not name the `git fetch` recovery command.
  - Three tests fail on Git 2.43: `crates/mokly-cli/tests/changes_failures_tests.rs::a_missing_historical_blob_is_git_failed_instead_of_unavailable_validation`, and `crates/mokly-git/tests/promisor_tests.rs::blobless_clone_fetches_missing_base_blobs_in_one_batch` and `::failed_promisor_fetch_names_recovery_command`.
- **Impact if no action:** A user whose CI runs Git 2.43, such as a self-hosted Ubuntu 24.04 runner or container, cannot publish from a blobless clone. The local complete gate fails on such a machine.
- **Root question:** How does `ensure_objects` find missing objects on every supported Git version?
- **Options:**
  - **A.** Send commit or tree ids that reach the needed blobs, not the blob ids themselves, so that `--missing=print` reports each missing blob on Git 2.43. Effort: Small (estimate).
  - **B.** Check each needed blob with `git cat-file --batch-check`, which reports `{id} missing` on every version, and fetch the missing ones. Effort: Small (estimate).
  - **C.** Require a newer Git and say so in the CLI requirements. Effort: Small. It keeps the defect for users on Git 2.43.
- **Left out:** Lazy fetch. Mokly disables it on purpose, so that one fetch batch gets every missing object.
- **Wider fix:** A test run on the oldest supported Git version in CI.
- **Recommendation:** B (estimate). It does not depend on how `rev-list` treats a missing tip.
- **Action:** fix after merge, because the combine branch changes no Mokly code.
