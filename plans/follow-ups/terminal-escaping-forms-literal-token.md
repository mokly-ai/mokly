# Terminal escaping can form a literal token

- **Severity:** High. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, during the independent check of finding 1 on branch `calummoore/fu-list-diagnostic-authored-line-feeds-nuzh`.
- **Location:** `crates/mokly-cli/src/redaction.rs:44`, `crates/mokly-cli/src/_tests_/redaction_tests.rs`, and `docs/protocol/mokly-upload.md:93`.
- **Reason:** This Redactor order predates the authored-line-feed producer change. The user limited that branch to its list diagnostic follow-up.

- **Source:** Review.
- **Category:** Security.
- **Terms:**
  - **Redactor:** The CLI type that removes configured tokens and escapes terminal controls before display.
  - **SecretMatcher:** The shared matcher in `mokly-publish` that recognizes literal and percent-encoded credential bytes.
- **Background:** The CLI collects `--token` and `MOKLY_TOKEN` before command validation. `Redactor::clean` first replaces matching values with `[redacted]`. It then escapes terminal controls with lowercase four-digit Unicode escapes. The Token Exposure rule also protects configured values that fail the token grammar.
- **Problem:** The final escape can create the literal configured value after its matching pass has finished. A configured value containing the literal characters `a\u0009b` does not match text made from `a`, TAB, and `b`. The escape then prints `a\u0009b` in full.
- **Impact if no action:** A terminal line can contain a configured malformed token even though literal matching is required. Both the ordinary and structural-line Redactor paths use this order.
- **Root question:** How can terminal escaping avoid forming an unredacted configured value after token matching?
- **Options:**
  - **A.** Match the existing literal and percent spellings again after control escaping. Keep the earlier match for raw control-bearing values. Add a focused regression for a literal escape token formed from a raw control. Check overlapping configured values and replacement markers. Effort: Small.
  - **B.** Carry raw text, final text, and redaction ranges through one presentation operation. Match both forms before writing output. This makes the order explicit and supports other presentation transforms. It adds range tracking and a larger renderer change. Effort: Medium.
- **Left out:** Changing only the order loses raw control-bearing tokens after escaping. Rejecting malformed tokens removes required protection. Passing raw controls to the terminal violates the terminal contract. Fewer than three valid approaches remain because the renderer must check final text or retain both forms.
- **Wider fix:** B. Keeping the raw and final forms lets one presentation operation protect both without relying on an earlier formatter's order.
- **Previous examples:** `crates/mokly-cli/src/static_errors.rs:119` escapes path controls before matching. The catalogue and sidecar list builders now do the same for authored list values. Those reverse-order cases are recorded in [control-escaped-token-redaction.md](./control-escaped-token-redaction.md).
- **Related:** [control-escaped-token-redaction.md](./control-escaped-token-redaction.md) shares the redaction and control-escape code. Its recommended matcher mode fixes control-bearing token values after producer escaping. It does not fix the literal-escape value formed after Redactor's own escape.
- **Recommendation:** A. It checks the final literal spelling with the existing matcher and keeps the current raw-value match. B is the structural wider fix.
- **Action:** fix after merge, apply A, because this existing defect is outside the current branch's authorized producer change. Its fix belongs in a separate branch.

- **Evidence:** A read-only probe used the existing `target/debug/mokly` with `CI=1` and an unknown command. With `MOKLY_TOKEN` set to the literal `a\u0009b`, raw text made from `a`, TAB, and `b` printed `a\u0009b`. The same literal text as input printed `[redacted]`. The probe changed no source or repository state.
- **Requirements:** Preserve `docs/protocol/mokly-upload.md` Token Exposure matching for literal and mixed `%HH` bytes. Keep malformed values protected. Preserve the structural line feeds selected by `safe_lines`, and keep controls escaped in ordinary output.
