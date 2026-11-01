# Align saved-slot reserved metadata validation

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of round 2 of the decision work review.
- **Location:** `crates/mokly-catalogue/src/html_tokens.rs:92`,
  `crates/mokly-catalogue/src/html_tokens.rs:105`, and
  `docs/protocol/mokly-html-screens.md:139`.
- **Reason:** A second review of the HTML decision work of 2026-10-26 found
  this mismatch outside its change, so a separate branch decides it.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Reserved navigation metadata:** the attributes `data-mokly-link` and
    `data-mokly-link-control…`, which only Mokly's link adapter may write.
  - **Saved slot:** slot content that a saved component variant supplies in
    its front matter, instead of an authored body.
  - **Ignore wrapper:** a `mokly-ignore` or `mokly-ignore-scope` element
    that marks a region that Changes ignores.
- **Background:** `docs/protocol/mokly-html-screens.md` sets two rules for
  reserved navigation names. A body or callback output that supplies one
  fails. A saved slot warns that the name is rejected.
  `html_tokens::ignore_warning_message` writes that warning as
  `reserved navigation metadata {name} on {tag} is rejected`. The
  composition wrapper filter keeps reserved navigation names, and the build
  continues.
- **Problem:** The warning says "is rejected", but a saved slot with a
  literal reserved value builds. The text, the code, and the body rule
  disagree about whether the name fails.
- **Impact if no action:** An author reads that the build rejected the
  attribute, while the build passes.
- **Root question:** What should happen when a saved slot supplies a
  reserved navigation name?
- **Options:**
  - **A.** Keep the build passing, and change the warning text and the
    screens contract so that they no longer say that the name is rejected.
    Effort: Small.
  - **B.** Fail the build for a reserved navigation name on a saved-slot
    wrapper, as for a body. This adds a build error and changes the screens
    contract. Effort: Small.
  - **C.** One validation rule for reserved navigation names in all
    authored HTML: bodies, saved slots, and both ignore wrappers. Each
    failure names its file and position or its slot field. This adds a
    build error for saved slots. Effort: Medium.
- **Left out:** Keeping the attribute breaks the contract rule that only
  the link adapter writes reserved navigation names.
- **Wider fix:** C. One rule removes the separate saved-slot path.
- **Previous examples:** On 2026-10-26 the user chose to make the
  composition wrapper filter call the catalogue rule instead of its own
  copy of the allow list.
- **Related:**
  - [reserved-navigation-diagnostic-source.md](./reserved-navigation-diagnostic-source.md):
    the body failure for the same names says "in consumer output". C would
    also replace its wider fix.
  - [ignore-scope-reserved-name.md](./ignore-scope-reserved-name.md): a
    saved-slot `mokly-ignore-scope` does not evaluate a reserved name that
    `mokly-ignore` evaluates. C covers it.
  - [saved-variant-slot-checks.md](./saved-variant-slot-checks.md) decides
    the same body-versus-saved-slot question for the element checks. One
    rule for authored HTML would settle both.
- **Recommendation:** C. It gives authored HTML one rule and one
  message.
- **Action:** ask the user, because every option changes the saved-slot rule of
  the screens contract. B and C also add a build error.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5583).
