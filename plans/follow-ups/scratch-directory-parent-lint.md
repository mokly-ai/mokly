# Scratch directories need their parent created

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from branch `calummoore/ci-speed-last-mile-fixed-costs-and-9n1q`, review finding 6 (wider fix).
- **Location:** `scripts/verification/rust-test-weights.mjs` (`measureCompile`), `scripts/verification/rust-audit-tool.mjs:106`, `scripts/verification/process-owner.mjs:41`, `scripts/verification/static-delivery.mjs:17`.
- **Reason:** The only fix that prevents the class is a new lint, and a new lint needs the user's approval.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **`.context/`:** the Git-ignored folder for local scratch output. A fresh checkout does not have it.
  - **`fs.mkdtemp`:** the Node call that makes a unique temporary folder. It fails with `ENOENT` when its parent folder is missing.
- **Background:** Four verification scripts make a scratch folder under `.context/` with `fs.mkdtemp`. Each must first create `.context/` with `fs.mkdir(..., { recursive: true })`.
- **Problem:** `rust-test-weights.mjs --compile` first called `fs.mkdtemp` without the `mkdir`, so it failed on a fresh checkout before Cargo started. The branch fixed that call site. Nothing stops the next script from making the same mistake.
- **Impact if no action:** A new scratch-folder caller can fail on a fresh checkout with an `ENOENT` error that names the missing path. A maintainer works around it with one `mkdir`.
- **Root question:** How does every script that makes a scratch folder under `.context/` create its parent first?
- **Options:**
  - **A.** No change. Four call sites do it right, and the error names the cause. Effort: Small.
  - **B.** Add one shared helper that creates `.context/` and a unique child, and move the four call sites to it. New code can still skip it. Effort: Small.
  - **C.** B, plus a repository lint that rejects a direct `fs.mkdtemp` under `.context` in `scripts/`. This adds a lint, so it needs the user's approval. Effort: Medium.
- **Left out:** The system temporary folder, because it is often a RAM-backed `tmpfs` that a cold Rust build can fill.
- **Wider fix:** C. Only the lint prevents the class.
- **Previous examples:** `rust-test-weights.mjs --compile` on this branch.
- **Recommendation:** A. The class has one known case, now fixed, and its failure is loud and cheap.
- **Action:** ask the user, because the class fix is a new lint.
