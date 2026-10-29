# Start sidecars before the background pass

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #225 and its completed plan.
- **Location:** Serve background startup.
- **Reason:** The review or plan deferred this work until after PR #225.

Start the sidecars and replay the generation before the background pass. This removes startup from the first background render.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L93).
