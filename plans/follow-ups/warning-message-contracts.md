# Define the missing warning messages

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 87 (CLI defaults hub finding 5): define the new
warning messages. `html-ignore-attribute`, `props-control-bounds`,
and `props-unsafe-integer` have no defined message. Invocation
warnings name the rendered entry and only the prop path, for example
entry "home": prop "/count" when `home` has no `count` prop, and they
merge with the entry's own warning. Prop names appear as "/count" and
as "count". Severity Low, effort Medium for B. Options: A, define the
current messages in the three contracts and add the code to the HTML
Diagnostics table, Small (estimate); B, also make invocation warnings
name the component path and the instance id and use one prop-name
form, then define the messages, Medium. Recommended: B.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5851).
