# Define the missing warning messages

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** The three warning producers and their protocol tables.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** docs or spec.
- **Background:** Three warning codes lack defined messages. Invocation warnings also use two prop-path forms and omit the component instance.
- **Problem:** Messages can change independently, and an invocation warning can identify only the rendered entry.
- **Impact if no action:** Users can receive inconsistent paths and insufficient context for the same prop problem.
- **Root question:** How should Mokly define the missing warning messages?
- **Options:**
  - **A.** Define the current three messages and add the missing diagnostic code to the table. Effort: Small.
  - **B.** Also name component path and instance id. Use one prop-path form before defining every message. Effort: Medium.
- **Left out:** Generating messages from tests makes tests, not the protocol, own user-facing behavior.
- **Wider fix:** B. One invocation context and path format prevent message drift.
- **Previous examples:** CLI defaults hub finding 5 records the current message and path differences.
- **Recommendation:** B. It defines consistent messages with enough recovery context.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5851).
