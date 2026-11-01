# Name authored templates in navigation diagnostics

- **Severity:** Low (estimate). **Likelihood:** Rare (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of the implementation review of 2026-10-28. Updated 2026-11-01 on branch `conductor/rust-rebuild-87-diagnostics-and-html-messages`.
- **Location:** `crates/mokly-html/src/source_checks.rs:15`,
  `crates/mokly-html/src/source_locations.rs:11`, and
  `crates/mokly-html/src/javascript.rs:130`.
- **Reason:** The implementation review of 2026-10-28 found this wording
  outside its change, so a separate branch fixes it.

- **Source:** Review.
- **Category:** Product bug (estimate).
- **Terms:**
  - **Reserved navigation metadata:** the attributes `data-mokly-link` and
    `data-mokly-link-control…`, which only Mokly's link adapter may write.
  - **Consumer output:** HTML that a JavaScript callback of the consumer
    returns, such as a `renderPage` document.
- **Background:** `docs/protocol/mokly-html-screens.md` says that an
  authored body or callback output that supplies a reserved navigation name
  fails. `source_checks::validate` applies that rule. It rejects a start tag
  that carries a reserved name with `build-invalid` and the text
  `reserved navigation metadata in consumer output`. Two callers use it:
  `source_locations.rs` for an authored template body, and `javascript.rs`
  for callback output.
- **Problem:** For an authored template body, the message still says "in
  consumer output", although the attribute came from an authored file.
- **Impact if no action:** An author looks for the attribute in callback
  or renderer output instead of in the template body.
- **Root question:** How should the reserved-metadata failure name the
  input that holds the attribute?
- **Options:**
  - **A.** Pass the input kind to `validate`, and name "authored HTML" or
    "consumer output" in the message. Effort: Small (estimate).
  - **B.** Fail reserved navigation names in authored HTML during catalogue
    validation, with the attribute's file, line, and column. Keep the
    render-time check for callback output. Effort: Medium (estimate).
- **Left out:** Removing the check lets authored metadata change
  navigation, which the screens contract forbids. Only two distinct
  approaches exist: fix the message at render time, or move the authored
  check to validation.
- **Wider fix:** B. One validation rule for authored HTML names the file
  and position of each reserved attribute.
- **Previous examples:** None found.
- **Related:**
  [reserved-navigation-names-in-authored-html.md](./reserved-navigation-names-in-authored-html.md)
  asks the user how authored HTML reports the same reserved names, also in
  saved slots and on both ignore wrappers. Each of its options includes the
  wording fix of A here, so the branch that applies the user's choice there
  also fixes this item. Its options D and C also give a body failure its
  file, line, and column, as B here does.
- **Recommendation:** A. (estimate) It corrects the wrong input name with
  the smallest change. B best protects the codebase.
- **Action:** fix after merge, apply A (estimate), because a diagnostic
  that names the wrong input is a product bug, and A keeps every rule.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5602).
