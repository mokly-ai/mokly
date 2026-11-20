# Production ingest timing has no recorded measurement

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the post-merge notes of the deleted `plans/publication-storage-scaling.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** The production ingest traces, `crates/mkc-publications/src/preflight.rs:183-193`, `crates/mkc-publications/src/blob_upload.rs:71-93` and `docs/ops/maintenance.md`.
- **Reason:** The review needs real production publishes, which exist only after the merge.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify a review. The traces exist in the code, but the repository holds no production measurement.

- **Terms:**
  - **Reuse ratio:** The share of a publish's distinct content hashes that the project had already stored. The plan trace gives it through its `distinct_hashes` and `missing` fields.
- **Background:**
  - The storage scaling change of 2026-09-28 made ingest write only content that the project has not stored.
  - The delta upload of 2026-10-02 made the CLI send only the missing files. `docs/ops/environment.md:269-280` describes the skip of each hash that has a durability marker.
  - The plan trace in `preflight.rs:183-193` reports `files`, `distinct_hashes`, `missing`, `written`, `bytes` and `write_duration_ms`. There is no field for skipped files.
  - Each blob store in `blob_upload.rs:71-93` reports `written`, `bytes` and `write_duration_ms`.
  - The plan asked to watch production ingest tracing for write duration and skipped ratios, and to confirm that repeat publishes complete within seconds. That target is history from the plan, not a requirement or a timing gate.
  - The repository records no such review. An absent record does not prove that nobody read the traces.
- **Task:** After real production publishes, read the plan and blob traces. Record the production revision and configuration, the measurement window, the reuse ratio, the write duration and bytes, and the duration of a repeat publish. Record them in `docs/ops/maintenance.md`.
- **Impact if no action:** A slow ingest path stays unnoticed until users complain about publish times.
- **Needs:** Real production publishes and access to the production traces.
- **Done when:** The maintenance runbook records the dated measurements. A slow result becomes its own follow-up item.

Source: [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/publication-storage-scaling.md?plain=1#L586-L607) of the deleted plan.
