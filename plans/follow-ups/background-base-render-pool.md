# Give background base work its own render pool

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #228, decision 9 of the stylesheet bundle
  performance plan, and review finding 1 of step A.
- **Location:** `crates/mokly-cli/src/serve_changes_native.rs` and
  `crates/mokly-graph/src/session_collection.rs`.
- **Reason:** The orchestrator chose to change the shared render pool in a
  separate branch, because the base comparison capture on `origin/main` has
  the same problem and needs its own review.

Serve's Changes classification prepares a base side, the historical
version of the catalogue, beside the live catalogue. Base work can wait at
Serve's sidecar admission gate while it holds a render worker that a
foreground document render needs. PR #228 removed the case for base
stylesheet roots: they bundle on the classification thread. The base
comparison capture can still fill every render worker with jobs that wait
at the admission gate.

The task: give Serve's background base work its own render pool, so that
no base job holds a worker that a foreground render needs. Cover the base
comparison capture in `session_collection.rs`. The task needs no deployed
change or credentials.
