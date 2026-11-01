# Define saved variant slot element checks

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 128, from the F21 decision record. Updated 2026-11-01 on branch `conductor/rust-rebuild-87-diagnostics-and-html-messages`.
- **Location:** `crates/mokly-catalogue/src/template_role.rs:57`,
  `crates/mokly-catalogue/src/templates.rs:161-181`, in `Checker::start`,
  `crates/mokly-catalogue/tests/ignore_attribute_tests.rs:182-199`, and
  `docs/protocol/mokly-html-components.md:85`.
- **Reason:** The Variants section states no check rule for saved slots, so each
  option adds a requirement, and option A adds a build error.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Saved slot:** an HTML fragment that a saved component variant
    supplies for a declared slot in its front matter, under `slots`.
  - **Element checks:** the body checks that fail a forbidden element, such
    as `script` or an unknown `mokly-` name, and an unknown custom element.
- **Background:**
  - The Variants section of `docs/protocol/mokly-html-components.md` says
    that a variant's `slots` maps slot names to HTML fragments. It states no
    rule for the checks that those fragments get.
  - `templates.rs` runs the element checks only when
    `TemplateRole::check_elements` holds, and that holds only for an entry
    body. So saved slots skip the forbidden and unknown element checks
    today.
  - The Rust rebuild of PR #199 kept that skip, because a new build error
    needs the user's approval.
  - The test `saved_variant_slots_keep_element_failures_deferred` in
    `crates/mokly-catalogue/tests/ignore_attribute_tests.rs:182-199` locks
    today's behaviour. It prepares saved slots with `<unknown-widget>` and
    with `<script>`, and it expects no error.
- **Problem:** The protocol does not say which body checks apply to saved
  slots. The code skips two of them without a recorded rule. Probes on
  2026-11-01, with a saved slot in the `children` slot of a component
  variant, gave these results:
  - A saved slot `<script>alert(1)</script>` builds with exit 0. The page
    holds `<div><script>alert(1)</script></div>`.
  - The same element in the component body fails with
    `specs/panel.component.html:7:6: [mokly/html-element] forbidden element script`.
  - A saved slot `<unknown-el>x</unknown-el>` builds with exit 0.
- **Impact if no action:** A script in a saved slot reaches the served page,
  although a body may not hold one. A saved slot can also hold an unknown
  custom element that a body would reject. A later refactor can add or
  remove checks without a requirement to test against.
- **Root question:** Which authored HTML checks should a saved slot get?
- **Options:**
  - **A.** Apply the body element checks to saved slots, and state the rule
    in the Variants section. Each failure names the slot's front matter
    field. This adds a build error. The work of A, as planned on
    2026-10-28: add failing catalogue tests in which a saved slot with
    `script`, `html`, `head`, `body`, `base`, `mokly-foo`, or an unknown
    hyphenated element fails with `html-element` at the slot field, and a
    CLI test in which a saved slot with `<script>` fails and writes no
    output; apply the element checks to the saved-slot role; update
    `saved_variant_slots_keep_element_failures_deferred` and record the
    changed expectation and its decision in the commit body; state in
    `docs/guides/authoring/components.md` that saved slot HTML follows the
    body element rules; and update the READMEs of `crates/mokly-catalogue`
    and `crates/mokly-html`. `crates/mokly-catalogue/src/templates.rs` has
    280 lines, under the cap of 300, so move its attribute checks into
    their own module before A adds checks. Effort: Medium.
  - **B.** Keep only the required `html-ignore-attribute` and
    `html-foster-parented` warnings for saved slots, and state that saved
    slots skip the element checks. Effort: Small.
  - **C.** Warn about these elements instead. Normal builds continue, and
    `--strict` builds fail. This adds a warning code and its message to the
    protocol. Effort: Medium.
- **Left out:** Skipping every check also drops the two required warnings,
  `html-ignore-attribute` and `html-foster-parented`. Changing nothing
  leaves the protocol without a rule, and B keeps the same behaviour with a
  rule.
- **Wider fix:** A. One rule for all authored HTML prevents checks that
  differ by where the HTML is written.
- **Previous examples:** Reserved navigation names also differ by place: a
  body fails, and a saved slot only warns. Saved slots also skip the
  duplicate navigation check of a body.
- **Related:**
  - [reserved-navigation-names-in-authored-html.md](./reserved-navigation-names-in-authored-html.md)
    decides the same body-versus-saved-slot question for reserved navigation
    names. Its option C and A here share the wider fix, one validation for
    all authored HTML.
  - [saved-slot-duplicate-navigation.md](./saved-slot-duplicate-navigation.md)
    decides the same question for the duplicate navigation check. Its
    option B shares the same wider fix.
- **Recommendation:** A. It gives saved slots the checks of every other
  authored HTML.
- **Action:** ask the user, because each option adds a check rule that the
  Variants section of `docs/protocol/mokly-html-components.md` does not state,
  A also adds build errors, and C adds a warning that strict builds count.
  The coordinator's answer of 2026-10-28 also kept this choice for the user.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6018).
