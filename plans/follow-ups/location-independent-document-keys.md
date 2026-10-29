# Make JavaScript document keys location-independent

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `packages/mokly/src/sidecar/bundle.ts` and document-key construction.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** product bug.
- **Background:** The sidecar bundle identity feeds every JavaScript document key. It hashes absolute roots and ancestor package manifests.
- **Problem:** The same commit in two folders changes 545 keys. An unrelated root devDependency edit rekeys all JavaScript entries.
- **Impact if no action:** Published identity changes without a render input change. Cache reuse and deployment identity become location-dependent.
- **Root question:** How should Mokly make JavaScript document keys location-independent?
- **Options:**
  - **A.** Document absolute roots and all ancestor manifests as render inputs. Effort: Small.
  - **B.** Keep them in compiled-code keys. Build published keys from repository-relative module digests, class maps, and bindings. Effort: Medium.
  - **C.** Make the complete bundle identity folder-independent. Effort: Large.
- **Left out:** Dropping package metadata from every key can reuse compiled code across incompatible resolution settings.
- **Wider fix:** C. A folder-independent bundle identity removes the class at its source.
- **Previous examples:** Integration batch 19 found 545 changed keys between two folders.
- **Recommendation:** B. It fixes published identity while keeping conservative compiled-code reuse. C best protects every bundle consumer.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6063).
