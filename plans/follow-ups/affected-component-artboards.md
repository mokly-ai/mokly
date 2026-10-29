# Add the missing affected-component artboards

- **Severity:** Low. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 104 (82 B delegate decision 6, with the second
user decision 82 follow-up and 103 C review finding 1): the
component artboard shows only screens in Affected, and no artboard
depicts an affected-only component's comparison, which reads
"Components this variant uses changed". Severity Low, effort Large
for B, because B is a new artboard. Options: A, keep the component
case in the design copy only, Small (estimate); B, draw three states
in the separate branch that fixes the design's Affected list: the
affected component variant, an Unmodified view that stays in Changes
and shows the band, and the component's Affected list, which shows
components too, Large. Recommended: B. With either option, correct
the sentence of `mokly-component-design.md` that gives known
unchanged shown views no comparison row.

- 103 C review finding 1 widened option B on 2026-10-21. The
  affected-screen artboard, `affectedScreenScreen` in
  `examples/basic/specs/design/components/states/shared-impact/screens.tsx`,
  already covers the screen state. The Moved artboard,
  `review/outcomes/moved.tsx`, shows changed content, so it does not
  cover an Unmodified affected view.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5918).
