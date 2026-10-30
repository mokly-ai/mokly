# Name authored templates in navigation diagnostics

- **Severity:** Low (estimate). **Likelihood:** Rare (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of the implementation review of 2026-10-28.
- **Location:** `crates/mokly-html/src/source_checks.rs:15`,
  `crates/mokly-html/src/source_locations.rs:11`, and
  `crates/mokly-html/src/javascript.rs:116`.
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
  - [saved-slot-reserved-metadata.md](./saved-slot-reserved-metadata.md):
    the same reserved names on a saved-slot wrapper only warn. Its wider
    fix is one rule for all authored HTML, which would also replace B.
  - [ignore-scope-reserved-name.md](./ignore-scope-reserved-name.md): a
    saved-slot `mokly-ignore-scope` does not evaluate a reserved name that
    `mokly-ignore` evaluates. It is the same class of rule.
  - [callback-duplicate-attribute-diagnostic.md](./callback-duplicate-attribute-diagnostic.md):
    the duplicate-attribute message of the same `source_checks::validate`
    names every duplicate in callback output a navigation attribute. Both
    items correct wrong wording in one function, so one branch can fix both.
- **Recommendation:** A. (estimate) It corrects the wrong input name with
  the smallest change. B best protects the codebase.
- **Action:** fix after merge, apply A (estimate), because a diagnostic
  that names the wrong input is a product bug, and A keeps every rule.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5602).
