# Rust cache save check reads expressions by hand

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the review of branch `calummoore/ci-speed-native-fixed-costs-and-luqv`.
- **Location:** `tests/ci_rust_cache.test.ts`, `savesOnlyFromMain`.
- **Reason:** The branch fixes the reported case: the check skips quoted strings before it counts parentheses. A parser adds a verification dependency.
- **Category:** Test.

- **Background:** `tests/ci_rust_cache.test.ts` checks that every Rust cache step of CI saves only on `main`. A `save-if` value passes when it is the `main` check alone, or the `main` check and more terms with no `||` outside parentheses and quoted strings.
- **Problem:** The check reads the GitHub Actions expression with its own scanner. Another expression form that the scanner does not know can make a valid condition fail, or let a wrong one pass.
- **Impact if no action:** None today. Every current `save-if` value passes, and a top-level `||` fails.
- **Root question:** How can the check read each save condition with the grammar that GitHub uses?
- **Options:**
  - **A.** Keep the scanner, and extend it when a new form appears. Effort: Small.
  - **B.** Parse each condition with the GitHub Actions expression parser, and check that the `main` term holds on every path. Effort: Medium.
- **Left out:** Matching the current workflow strings. It misses a policy regression in a new condition.
- **Wider fix:** B.
- **Recommendation:** B. One grammar reads every condition.
- **Action:** fix after merge, apply B.
