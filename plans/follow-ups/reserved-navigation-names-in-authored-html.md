# Authored HTML reports reserved navigation names inconsistently

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan, as
  two items outside the scope of round 2 of the HTML decision work review:
  `saved-slot-reserved-metadata.md` and `ignore-scope-reserved-name.md`.
  Merged on 2026-11-01 on branch
  `conductor/rust-rebuild-87-diagnostics-and-html-messages`, as finding 1 of
  its plan.
- **Location:** `crates/mokly-catalogue/src/html_tokens.rs:91-102`,
  `crates/mokly-html/src/elements.rs:30-48`,
  `crates/mokly-html/src/source_checks.rs:15-19`, and
  `docs/protocol/mokly-html-screens.md:142` and `:192`.
- **Reason:** On 2026-11-01 the diagnostics branch left this choice to the
  user, because each option changes a protocol rule or adds a build error.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Reserved navigation name:** the attribute `data-mokly-link`, or an
    attribute whose name starts with `data-mokly-link-control`. Only Mokly's
    link adapter may write these names.
  - **Authored HTML:** the HTML of an entry body or a saved slot, which an
    author writes in a catalogue file.
  - **Saved slot:** an HTML fragment that a saved component variant supplies
    for a declared slot, under `slots` in its front matter.
  - **Ignore wrapper:** a `mokly-ignore` or `mokly-ignore-scope` element. It
    marks or scopes a region that Changes ignores, and it leaves nothing in
    the output.
  - **Callback output:** the HTML that a JavaScript render callback returns
    through the render sidecar. Failure messages call it "consumer output".
- **Background:**
  - `docs/protocol/mokly-html-screens.md:135-138` says that `mokly-ignore`
    accepts `id` and `material-key`, and that `mokly-ignore-scope` accepts
    `enabled`. Both accept `mokly-if` and `mokly-viewport`. Other wrapper
    attributes are unknown: they warn, and their values are not evaluated.
  - Line 142 of that page says that reserved navigation names are not
    unknown attributes. A body or callback output that supplies one fails. A
    saved slot warns that the name is rejected.
  - Line 192 of that page defines that warning. Its code is
    `html-ignore-attribute`. Its message is
    `reserved navigation metadata <name> on <mokly-ignore> is rejected`,
    with `<mokly-ignore-scope>` on a scope wrapper.
  - `html_tokens::ignore_warning_message` at
    `crates/mokly-catalogue/src/html_tokens.rs:91-102` writes this message.
    `html_tokens::reserved_navigation_attribute` at line 105 defines the
    reserved names. Catalogue preparation gives the warning for a body and
    for a saved slot.
  - On 2026-10-26 the user decided that the composition wrapper filter calls
    the catalogue rule, instead of its own copy of the allow list. This
    filter, `ignore_checks::filter_attributes` at
    `crates/mokly-html/src/elements.rs:26`, keeps the allowed attributes and
    the reserved navigation names on both wrappers.
  - A body that supplies a reserved name fails during rendering.
    `source_checks::validate` at
    `crates/mokly-html/src/source_checks.rs:15-19` rejects each start tag
    with a reserved name. The failure has the code `build-invalid` and the
    text `reserved navigation metadata in consumer output`.
  - That failure names the document route, not the file, the line, or the
    column. Composition runs this check on bodies and on callback output,
    not on saved slots.
  - In a saved slot, an ordinary element with a reserved name still fails
    during rendering. Link rewriting rejects `data-mokly-link`, at
    `crates/mokly-html/src/links.rs:103-107`. Link-control adaptation rejects
    a `data-mokly-link-control` name, at
    `crates/mokly-html/src/controls.rs:68-77`.
  - An ignore wrapper leaves no element in the output, so these two checks
    never see its attributes. Only the wrappers of a saved slot therefore
    pass with a warning.
  - For `mokly-ignore`, `elements.rs:45-48` evaluates every kept attribute
    with `conditions::attributes`. A whole-value `{{missing}}` reference to
    an undeclared prop then fails with `html-props`, in
    `crates/mokly-html/src/conditions.rs:51-75`. The user's decision of
    2026-10-26 kept this failure.
  - For `mokly-ignore-scope`, `elements.rs:30-44` reads only `enabled`. It
    never evaluates the other kept attributes.
  - These tests pin today's behaviour. A change must update them, keep each
    assertion that still holds, and record each changed expectation and its
    decision in the commit body:
    `reserved_navigation_warning_names_rejection_instead_of_ignoring` at
    `crates/mokly-catalogue/tests/ignore_attribute_tests.rs:143`,
    `saved_slot_reserved_wrapper_attributes_stay_visible_to_composition` at
    `crates/mokly-cli/tests/ignore_warning_tests.rs:63`, and
    `reserved_navigation_fields_remain_visible_and_fail_as_before` at
    `crates/mokly-html/src/_tests_/ignore_parsing_tests.rs:224`.
  - `crates/mokly-catalogue/src/templates.rs` has 280 lines, and the
    repository caps Rust files at 300. Move its attribute checks into their
    own module before a change adds checks there.
- **Problem:** The warning says that the name is rejected, but a saved slot
  with a literal value builds. The two wrappers also treat one invalid
  reference in different ways. Probes on 2026-11-01, with a saved slot in the
  `children` slot of a component variant, gave these results:
  - `<mokly-ignore id='a' data-mokly-link='literal'>`: the warning
    `reserved navigation metadata data-mokly-link on <mokly-ignore> is rejected`,
    then exit 0.
  - `<mokly-ignore-scope enabled='true' data-mokly-link='{{missing}}'>`:
    the same warning for `<mokly-ignore-scope>`, then exit 0.
  - `<mokly-ignore id='a' data-mokly-link='{{missing}}'>`: the warning, then
    `specs/panel.component.html:7:5: [mokly/html-props] undeclared prop reference missing`,
    and exit 1.
- **Impact if no action:** An author reads that the build rejected the
  attribute, while the build passes. A typo in a reference on the scope
  wrapper gives no error, while the same typo on `mokly-ignore` fails.
- **Root question:** How should authored HTML report reserved navigation
  names?
- **Options:**
  - **A.** Change only the words. The saved-slot warning says "is removed"
    instead of "is rejected". The render failure says "authored HTML" for a
    body and "consumer output" for callback output. This changes the
    protocol's warning text. Effort: Small.
  - **D.** Do A, and also give body render failures the file, line, and
    column. It adds no rejection, but it changes the protocol text as A
    does. Effort: Small.
  - **B.** Do A, and also evaluate the value on a saved-slot
    `mokly-ignore-scope`, as `mokly-ignore` does. That input then fails.
    Effort: Small.
  - **C.** Fail every reserved navigation name in authored HTML during
    catalogue validation, with `html-attribute`. A body failure gives the
    file, line, and column. A saved-slot failure gives its front matter
    field. The saved-slot warning goes. Saved slots then fail, and
    `mokly serve` rejects the whole rebuild instead of one view. The design
    of 2026-10-28 for C: the message is `<name> is reserved for Mokly`; the
    token boundary reports each reserved name and its span instead of a
    flag; the render-time check stays as a backstop, and its message names
    its input, authored HTML or consumer output. C adds failing tests for a
    reserved name on a saved-slot wrapper, on an ordinary saved-slot element,
    and in a body, where the failure names the attribute's line and column.
    C updates `docs/protocol/mokly-html-screens.md` (a reserved name fails
    in a body, a saved slot, and callback output; authored HTML fails with
    `html-attribute` at the attribute or the slot field; the sentence "a
    saved slot warns that the name is rejected" goes),
    `docs/protocol/mokly-html-components.md` (saved slot fragments use the
    body checks, and each failure names the slot field), and the READMEs of
    `crates/mokly-catalogue` and `crates/mokly-html`. Effort: Medium.
- **Left out:**
  - Keep the reserved name in the output. It breaks the rule that only Mokly
    writes these names.
  - Stop the evaluation on `mokly-ignore` too. It removes the failure that
    the user kept on 2026-10-26.
  - Change nothing, and state the difference between the wrappers in
    `docs/protocol/mokly-html-screens.md`. The warning then still says "is
    rejected" while the build passes.
- **Wider fix:** C. One validation rule for all authored HTML removes the
  separate saved-slot path and the separate evaluation of each wrapper.
- **Previous examples:** Until the user's decision of 2026-10-26, the
  composition wrapper filter repeated the catalogue allow list instead of
  calling the catalogue rule.
- **Related:**
  - [saved-variant-slot-checks.md](./saved-variant-slot-checks.md): saved
    slots also skip the forbidden and unknown element checks of a body. It
    shares the wider fix, one validation for all authored HTML.
  - [saved-slot-duplicate-navigation.md](./saved-slot-duplicate-navigation.md):
    saved slots also skip the duplicate navigation check of a body. It
    shares the same wider fix. Its option A, if it runs the body check
    unchanged, also fails reserved names in saved slots, which is part of C
    here.
  - [reserved-navigation-diagnostic-source.md](./reserved-navigation-diagnostic-source.md)
    records the wording and the location of the body failure alone, as a fix
    after merge. Each option here includes its wording fix, and D and C also
    give the location.
- **Recommendation:** C. It gives all authored HTML one rule and useful
  locations. D is the best smaller option.
- **Action:** ask the user, because C adds build errors for saved slots, and
  A, D, and B change the protocol's rule that a saved slot only warns that
  the name is rejected. B also adds a failure.

The two earlier items are
[saved-slot-reserved-metadata.md](https://github.com/mokly-ai/mokly/blob/a5cd66c7c16ea76f2da7391e712f9fe8ac9811d1/plans/follow-ups/saved-slot-reserved-metadata.md)
and
[ignore-scope-reserved-name.md](https://github.com/mokly-ai/mokly/blob/a5cd66c7c16ea76f2da7391e712f9fe8ac9811d1/plans/follow-ups/ignore-scope-reserved-name.md)
at `main` commit `a5cd66c7`. Their option letters differ from this item:

- Their "change the warning text" is A here.
- Their "evaluate the scope wrapper like `mokly-ignore`" is B here.
- Their "fail the saved-slot wrapper" and "one shared evaluation step" are
  covered by C here.
- Their "change nothing" is under **Left out**.

The full historical record is in the Rust rebuild plan at the commit before
deletion, at
[line 5583](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5583)
and
[line 5587](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5587).
