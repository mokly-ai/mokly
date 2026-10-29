# Confirm that hosted uploads skip unchanged details

- **Severity:** Low. **Effort:** Small.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #224.
- **Location:** `examples/basic` and the Mokly Cloud Plan exchange.
- **Reason:** The check needs the released change, a Mokly Cloud project that
  accepts index version 9, and its credentials.

Publish `examples/basic` to Mokly Cloud twice with one heading edit between
the two publications. Confirm that the second Plan answer asks only for the
changed files: the index, the ownership marker, the deployment file, and the
details, documents, and snapshots of the edited entries. A local build pair
with the same edit gave 15 new digests and 2,768,084 bytes, against 250
digests and 23,493,689 bytes before PR #224.
