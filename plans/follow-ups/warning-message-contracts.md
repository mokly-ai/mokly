# Define the missing warning messages

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 87, CLI defaults hub finding 5.
- **Location:** `crates/mokly-catalogue/src/templates.rs:51`,
  `crates/mokly-catalogue/src/control_warnings.rs:32`,
  `crates/mokly-catalogue/src/numeric_warnings.rs:60`, and
  `docs/protocol/mokly-html-screens.md:173`.
- **Reason:** On 2026-10-21 the user deferred the open review items of PR #199
  and kept the final warning text as the user's choice.

- **Source:** Review.
- **Category:** Docs or spec (estimate).
- **Terms:**
  - **Invocation warning:** a prop warning about a component instance that
    an entry renders, rather than about the entry's own props.
- **Background:** Warning codes and their messages are defined as follows.
  - Each build warning has a code. The protocol defines the exact message of
    some codes, such as `html-unused-props` in the HTML Diagnostics table of
    `docs/protocol/mokly-html-screens.md`.
  - Three codes have no defined message: `html-ignore-attribute` from
    `templates.rs`, `props-control-bounds` from `control_warnings.rs`, and
    `props-unsafe-integer` from `numeric_warnings.rs`.
  - The HTML Diagnostics table also lacks the `html-ignore-attribute` code.
  - The rebuild keeps the numeric warning text in one formatter, so that a
    wording change needs one edit.
  - Invocation warnings merge with the entry's own warning, and prop names
    appear both as "/count" and as "count".
- **Problem:** The messages can change without a contract. Invocation warnings
  name only the rendered entry and the prop path, for example entry "home":
  prop "/count" when `home` has no `count` prop.
- **Impact if no action:** Users get different path forms and too little
  context for the same prop problem, and the text can drift.
- **Root question:** What should each warning message say, so that a user
  can find the prop and the instance that caused it?
- **Options:**
  - **A.** Define the current messages in the three contracts, and add the
    missing code to the HTML Diagnostics table. Effort: Small (estimate).
  - **B.** Also make invocation warnings name the component path and the
    instance id, and use one prop-name form. Then define the messages.
    Effort: Medium.
- **Left out:** Deriving the messages from tests makes the tests, not the
  protocol, own user-facing text. Only two approaches exist: define today's
  text, or improve it first and then define it.
- **Wider fix:** B. One invocation context and one path form stop the
  messages from drifting apart.
- **Previous examples:** None found.
- **Recommendation:** B. It defines consistent messages with enough context
  to fix the problem.
- **Action:** ask the user, because condition 5 holds: the user reserved
  the choice for each open review item of the rebuild, and the final warning
  text.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5851).
