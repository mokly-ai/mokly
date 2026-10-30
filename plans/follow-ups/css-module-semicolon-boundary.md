# Align the CSS Modules semicolon boundary

- **Severity:** Low. **Effort:** Small (estimate).
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  finding 2 of the review of the `rebuild/port-111c` work.
- **Location:** `docs/protocol/mokly-imported-styles-modules.md:61-70` and
  the section reader in `crates/mokly-css/src/token_sections.rs`.
- **Reason:** On 2026-10-26 the user chose to document the boundary and keep
  its alignment as a follow-up for a later choice.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Scoper:** the CSS Modules code in `crates/mokly-css` that renames
    local names before lightningcss bundles the stylesheet.
  - **Rule list:** a block that holds rules, such as the stylesheet itself
    or a keyframes block.
- **Background:**
  - On 2026-10-21 the user chose to take each statement's start and kind
    from cssparser's rule parsers. The CSS Modules scanners then read
    statements as lightningcss does.
  - A review of that work found one boundary that still differs. In a rule
    list, the scoper ends a statement at `;`, but cssparser ends a style
    rule or a keyframe only at its `{}` block.
  - The review gave two options. A narrows the protocol and README parity
    sentences and records the boundary. B aligns the boundary.
  - On 2026-10-26 the user chose A, and asked for a follow-up for the
    boundary. `docs/protocol/mokly-imported-styles-modules.md:61-70` now
    states the boundary. It says that alignment was not chosen, because no
    realistic stylesheet reaches it and the change would alter the
    diagnostics of stylesheets that fail today.
- **Problem:** The scoper and the bundler end some rule-list statements at
  different places. Text that the bundler drops can read as other
  statements for the scoper, and an `@value` that starts one of them fails.
- **Impact if no action:** A rare stylesheet gets a diagnostic for text that
  the bundler would drop. No realistic stylesheet is known to reach it.
- **Root question:** Where should the scoper end a rule-list statement?
- **Options:**
  - **A.** Keep the documented `;` boundary, and delete this item. Effort:
    Small.
  - **B.** End a rule-list statement only at its `{}` block, as cssparser
    does. Update the protocol page and its diagnostics. Effort: Medium
    (estimate).
- **Left out:** Change the bundler. lightningcss is a dependency, and its
  reading defines the output.
- **Wider fix:** B. One boundary rule removes this difference between the
  scoper and the bundler.
- **Previous examples:** The same review series aligned the start and kind
  of each statement, and documented the descriptor-block case of
  `@font-face`.
- **Related:** [css-module-custom-property-rules.md](css-module-custom-property-rules.md)
  is another statement that the scanners read differently in a rule list.
  B touches that case, so decide the two together.
- **Recommendation:** A (estimate). The protocol records why alignment was
  not chosen, and no realistic stylesheet reaches the boundary.
- **Action:** ask the user, because condition 5 holds: on 2026-10-26 the
  user documented the boundary and kept its alignment as a follow-up for a
  later choice.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6652).
