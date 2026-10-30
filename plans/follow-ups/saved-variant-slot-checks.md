# Define saved variant slot element checks

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 128, from the F21 decision record.
- **Location:** `crates/mokly-catalogue/src/template_role.rs:57`,
  `crates/mokly-catalogue/src/templates.rs:152`, and
  `docs/protocol/mokly-html-components.md:85`.
- **Reason:** On 2026-10-21 the user deferred the open review items of PR #199
  until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Docs or spec (estimate).
- **Terms:**
  - **Saved slot:** an HTML fragment that a saved component variant
    supplies for a declared slot in its front matter, under `slots`.
  - **Element checks:** the body checks that fail a forbidden element, such
    as `script` or an unknown `mokly-` name, and an unknown custom element.
- **Background:** The Variants section of
  `docs/protocol/mokly-html-components.md` says that a variant's `slots`
  maps slot names to HTML fragments. It states no rule for the checks that
  those fragments get. `templates.rs` runs the element checks only when
  `TemplateRole::check_elements` holds, and that holds only for an entry
  body. So saved slots skip the forbidden and unknown element checks today.
  The rebuild kept that skip, because a new build error needs the user's
  approval.
- **Problem:** The protocol does not say which body checks apply to saved
  slots. The code skips two of them without a recorded rule.
- **Impact if no action:** A saved slot can hold a `script` element or an
  unknown custom element that a body would reject. A later refactor can add
  or remove checks without a requirement to test against.
- **Root question:** Which authored HTML checks should a saved slot get?
- **Options:**
  - **A.** Apply the body element checks to saved slots, and state the rule
    in the Variants section. Each failure names the slot's front matter
    field. This adds a build error. Effort: Small (estimate).
  - **B.** Keep only the required `html-ignore-attribute` and
    `html-foster-parented` warnings for saved slots, and state that saved
    slots skip the element checks. Effort: Small (estimate).
- **Left out:** Skipping every check also drops the two required warnings.
  Only two distinct approaches exist: a saved slot follows the body checks,
  or it skips them.
- **Wider fix:** A. One rule for all authored HTML prevents checks that
  differ by where the HTML is written.
- **Previous examples:** Reserved navigation names also differ by place: a
  body fails, and a saved slot only warns.
- **Related:**
  [saved-slot-reserved-metadata.md](./saved-slot-reserved-metadata.md)
  decides the same body-versus-saved-slot question for reserved navigation
  names. One rule for authored HTML would settle both.
- **Recommendation:** A. It gives saved slots the checks of every other
  authored HTML.
- **Action:** ask the user, because condition 5 holds: the user reserved
  the choice for each open review item of the rebuild. Condition 3 also
  holds, because A adds a build error.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6018).
