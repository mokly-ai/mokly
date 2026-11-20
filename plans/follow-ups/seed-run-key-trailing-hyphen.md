# Seed run keys with a trailing hyphen

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the branch `calummoore/preview-environment-seeding-discussion`, review finding 1.
- **Location:** `infra/scripts/preview-seed-job.py:56`, `infra/scripts/preview_seed_job_run.py:60`, `crates/mkc-file-store-interface/src/seed_name.rs`, `docs/protocol/cloud/preview-seed.md` ("Seed Command"), `docs/protocol/cloud/preview-seed-job.md`.
- **Reason:** On 2026-10-30 Cal chose to handle this after the merge. The choice of option still waits for Cal.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. Both validators still accept a key that ends with a hyphen, and the Job name still appends the key.
- **Category:** Product bug (estimate).

- **Terms:**
  - **Run key:** the `--run` value of the preview seed. It names the seed folder `seed/<run>/` in the PR's bucket prefix and the Kubernetes Job `preview-seed-<run>`.
  - **Seed Job:** the Kubernetes Job that runs `mkc-api preview-seed --run <run>` in a PR's preview namespace.
- **Background:** After each preview deploy, `infra/scripts/preview-seed-job.py` creates the seed Job `preview-seed-<run>` from the suspended CronJob `preview-seed`. The script and the API's `SeedName` type accept run keys that match `[a-z0-9][a-z0-9-]{0,49}`. The preview workflow passes `<run id>-<run attempt>`, and the local stack passes `local`. Both end with a letter or a digit.
- **Problem:** The grammar accepts a key that ends with a hyphen, such as `retry-`. The Job name `preview-seed-retry-` then breaks the Kubernetes rule that a name ends with a letter or a digit, so Kubernetes refuses the Job after the script has staged the run.
- **Impact if no action:** An operator who runs the script by hand with such a key gets a failed seed. The workflow never builds such a key. After the merge, the run key grammar is a contract between `main`'s release script and the API binary of every PR, so a later change needs both sides.
- **Root question:** How can every accepted run key start a seed Job?
- **Options:**
  - **A.** Require a run key to end with a letter or a digit: `[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?`. Change `SeedName` in `crates/mkc-file-store-interface/src/seed_name.rs`, the check in `infra/scripts/preview-seed-job.py`, and the grammar in `docs/protocol/cloud/preview-seed.md`. Cost: stricter validation. Effort: Small.
  - **B.** Name the Job after a fixed-length hex digest of the run key, and keep the key itself for the bucket folder. Cost: the Job name no longer shows the run, and the documented name `preview-seed-<run>` changes. Effort: Small.
  - **D.** Make the release script accept only the workflow's key shape, two decimal numbers joined by a hyphen. The API command keeps its grammar. Cost: stricter validation, and an operator cannot choose another key. Effort: Small.
  - **E.** Give the Job one fixed name, such as `preview-seed-run`, and delete any Job with that name before the create. Cost: the rule of one Job for each workflow attempt in `docs/protocol/cloud/pr-preview-environments.md` changes. Effort: Small.
- **Left out:** Remove trailing hyphens from the key: two keys could then share one Job name. Let Kubernetes generate the name: it changes the documented name and adds a read of the created name, and B gives the same result with less code. Change only the docs: the script still accepts the key.
- **Wider fix:** A. The run key type then cannot hold a key that no Kubernetes name accepts.
- **Previous examples:** Commit `fe5fe58f` changed the run key grammar from `{0,62}` to `{0,49}` so that the Job name fits in 63 characters.
- **Recommendation:** A. Every real key already ends with a letter or a digit, and the Job name keeps showing the run.
- **Action:** ask the user, because condition 3 of the decision test holds. Every option is blocked: A and D add stricter validation, and B and E change a documented Job name requirement.
