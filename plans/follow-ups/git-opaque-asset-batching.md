# Batch Git reads for opaque assets

- **Severity:** Low. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 64 (engine R20-1, from M14 review 6 finding 8):
decide on streamed Git blob copies and batched digests. Each opaque
asset digest starts its own Git process, and delivery buffers a
copy. 64 assets cause 128 opaque Git commands, and a 16.78 MB file
needs two payload copies during delivery. Every bound holds.
Severity Low, effort Large. Options: A, remove per-asset process
startup and the extra full-blob buffer, and preserve all existing
bounds, Large; B, retain the measured adapter, Small (estimate).
Recommended: A. No option is applied.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5834).
