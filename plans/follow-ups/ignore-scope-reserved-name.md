# Check reserved names on saved ignore scopes

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a problem outside the scope of round 2 of the HTML pipeline decision work
  review, 2026-10-28.
- **Location:** `crates/mokly-html/src/elements.rs:26-48`.
- **Reason:** The review found the difference in code that its change did
  not edit, and each fix adds a build failure, which needs the user.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Ignore wrapper:** the `mokly-ignore` or `mokly-ignore-scope` element.
    It marks or scopes a region that Changes ignores and leaves nothing in
    the output.
  - **Saved slot:** slot content that a saved variant stores in its front
    matter.
  - **Reserved navigation name:** `data-mokly-link` or a
    `data-mokly-link-control…` attribute, which only Mokly may write.
- **Background:**
  - `docs/protocol/mokly-html-screens.md:135-139` says that `mokly-ignore`
    accepts `id` and `material-key`, and `mokly-ignore-scope` accepts
    `enabled`. A reserved navigation name is not an unknown attribute. A
    body or callback output that supplies one fails. A saved slot warns.
  - `elements.rs:26` filters the attributes of each element. It keeps the
    allowed wrapper attributes and the reserved navigation names.
  - For `mokly-ignore`, `elements.rs:45-48` evaluates every kept attribute
    with `conditions::attributes`. A whole-value `{{missing}}` reference to
    an undeclared prop then fails with `html-props`, in
    `crates/mokly-html/src/conditions.rs:51-75`.
  - On 2026-10-26 the user decided that composition uses the catalogue rule
    and keeps the reserved navigation names. That kept the earlier
    behaviour: a saved-slot `mokly-ignore` with
    `data-mokly-link='{{missing}}'` fails with `html-props`.
- **Problem:** For `mokly-ignore-scope`, `elements.rs:30-44` reads only
  `enabled` and never evaluates the other kept attributes. So the same
  `data-mokly-link='{{missing}}'` on a saved-slot `mokly-ignore-scope` does
  not fail.
- **Impact if no action:** The two wrappers treat one invalid reference in
  different ways. An author gets no error for a typo on the scope wrapper.
- **Root question:** How do both ignore wrappers treat a kept reserved
  attribute the same way?
- **Options:**
  - **A.** Evaluate the kept attributes of `mokly-ignore-scope` with
    `conditions::attributes`, as `mokly-ignore` does. It adds a failure
    that today's code does not raise. Effort: Small.
  - **B.** Change nothing, and state the difference in
    `docs/protocol/mokly-html-screens.md`. Effort: Small.
  - **C.** Evaluate the kept wrapper attributes once, in the shared step at
    `elements.rs:26`, so that every wrapper uses one path. It adds the same
    new failure as A. Effort: Small.
- **Left out:** Stop evaluating reserved names on `mokly-ignore` too. It
  removes the failure that the user kept on 2026-10-26.
- **Wider fix:** C. One shared step stops the two wrappers from drifting
  apart again.
- **Previous examples:** The wrapper filter had repeated the catalogue allow
  list until the user's decision of 2026-10-26 made it call the catalogue
  rule.
- **Related:**
  - [saved-slot-reserved-metadata.md](saved-slot-reserved-metadata.md) is
    about reserved metadata on a saved-slot wrapper with a literal value. It
    touches the same reserved names on saved slots, so one branch can settle
    both rules.
  - [reserved-navigation-diagnostic-source.md](reserved-navigation-diagnostic-source.md)
    is a separate case of the same class of rule for reserved navigation
    names. It fixes the message of `source_checks::validate`, which says "in
    consumer output" for an authored template body. This item changes the
    wrapper path in `crates/mokly-html/src/elements.rs`. The fixes touch
    different code, so each item needs its own change.
- **Recommendation:** C. It makes both wrappers follow one rule
  and prevents new differences.
- **Action:** ask the user, because A and C add a build failure for
  `mokly-ignore-scope` that today's code does not raise.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5587).
