# Bring the shell README under its length target

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 95 (F9b item 7, decision 23): the shell README
stays past 300 lines. It had 494 lines under one heading on
2026-10-21, for 193 flat files, and the link check reads only
`README.md` files, `docs/`, `plans/`, and `AGENTS.md`. Severity
Low, effort Small. Options: A, keep one page, add a heading per
subject, and record the exception, as decision 2 A did for the
browser test guide, Small; B, move the standalone paragraphs into
`src/standalone/README.md` and record the exception for the
rest, Small (estimate); C, split it into
`src/shell/docs/{subject}/README.md` pages, Small (estimate); D,
move the mechanics into module doc comments and keep an index,
Large. Recommended: A, because a split by subject needs doc-only
folders in the source tree, and module mechanics belong in code
comments.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5863).
