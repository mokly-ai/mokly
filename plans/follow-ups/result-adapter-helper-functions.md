# Unused error adapters escape the dead-code lint

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-16, from the branch `calummoore/compact-evicted-documents`, the wider fix of a dead-code finding of its second review round.
- **Location:** `crates/mokly-compare/src/comparison_error.rs:19`, the other `*Result` adapter traits of the workspace, and the error reference of the shared `rust` skill in `futex-ai/skills`.
- **Reason:** The fix reaches crates outside the branch and the shared skills repository, which needs its own pull request.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Error adapter:** a trait such as `CompareResult` or `CaptureResult` with an impl for each source error type, so that `.compare()` or `.capture()` turns that error into the crate's error.
  - **`dead_code` lint:** the compiler lint that the gate runs as an error through `cargo clippy --workspace --all-targets -- -D warnings`.
- **Background:**
  - The workspace has 11 adapter traits of this form in 7 crates.
  - rustc 1.95.0 gives no warning for an unused impl of a trait that has more than one impl. For an unused helper function, it gives "function is never used", and for an unconstructed variant, "variant is never constructed". A scratch crate confirmed this on 2026-11-16.
  - On 2026-11-16 the branch `calummoore/compact-evicted-documents` moved the document codec from `mokly-compare` to `mokly-graph`. The `CaptureResult` impl for `serde_json::Result` in `crates/mokly-compare/src/capture_error.rs` lost its only caller, and no lint reported it. A review found it by search, and the branch deleted it.
  - `crates/mokly-compare/src/comparison_error.rs:19` has a `CompareResult` impl for `mokly_catalogue::error::Result`. A search on 2026-11-16 found no caller: all 17 non-test `.compare()` calls take `mokly_graph::error::Result`. It has been there since commit `d935e6a66`.
- **Problem:** An adapter impl that loses its last caller stays in the code, because the compiler does not report it, and only a manual search finds it.
- **Impact if no action:** Every move of code between crates can leave dead error paths, as it did twice in this class.
- **Root question:** How do error paths stay limited to the failures that live code can produce, also when the code that produces them moves?
- **Options:**
  - **A.** Delete the unused `CompareResult` impl for `mokly_catalogue::error::Result`, after a compile check that it has no caller. Effort: Small.
  - **B.** A, and replace each adapter trait with more than one impl by one helper function for each source error, in the form of `capture_error::graph`, so that the `dead_code` lint fails the gate when a helper loses its last caller. Start with `CompareResult`, 17 call sites. Effort: Medium.
  - **C.** B, and add a rule to the error reference of the shared `rust` skill in `futex-ai/skills`: use one helper function for each source error, because the compiler does not report an unused impl of a trait with several impls. A trait with one impl is safe, because rustc reports "trait is never used". Effort: Medium.
- **Left out:** A test or a script that finds unused impls: it would need type information that only the compiler has, and the lint already gives it for helper functions.
- **Wider fix:** C. It prevents the class in every repository that uses the shared skill.
- **Previous examples:** The `CaptureResult` impl for `serde_json::Result`, deleted on 2026-11-16, and the `CompareResult` impl at `crates/mokly-compare/src/comparison_error.rs:19`.
- **Recommendation:** C. The lint then catches the next case, and the rule reaches the other repositories.
- **Action:** fix after merge, apply C, because it changes crates outside the branch and the shared skills repository.
