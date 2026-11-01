# Align shell breakpoint source claims

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of the F18 review of 2026-10-20.
- **Location:** `packages/viewer/src/shell/layout_breakpoint.ts:4`,
  `packages/viewer/src/shell/README.md:279`,
  `packages/viewer/src/shell/css_chrome_flow.ts:53`,
  `packages/viewer/src/shell/css_views_responsive.ts:143`, and
  `packages/viewer/src/viewer/styles.ts:33`.
- **Reason:** A viewer review found the false claim in files that its
  change did not touch, so a separate branch corrects it.

- **Source:** Review.
- **Category:** Docs or spec (estimate).
- **Terms:**
  - **`NARROW_SHELL`:** the media query `(width < 56.25rem)` in
    `layout_breakpoint.ts`, the shell's layout breakpoint at 900px.
- **Background:**
  - Below 900px the catalogue becomes a drawer and the inspector a bottom
    sheet.
  - The comment of `NARROW_SHELL` in `layout_breakpoint.ts`, at lines 3-8,
    says that every shell and viewer rule and script reads this one query.
    The shell README repeats the claim at lines 279-282.
  - Since PR #249 of 2026-10-30, `layout_breakpoint.ts` also exports the
    760px device query as `NARROW_LAYOUT`. The `@mokly/ui` stylesheets
    repeat both queries, and the viewer's styles test holds them to both.
    Before, they repeated only `NARROW_SHELL`. The 560px container query
    has no named constant.
  - `docs/protocol/mokly-shell-device-chrome.md:97-98` names two
    breakpoints: the layout breakpoint at 900px and the device breakpoint at
    760px. So the comment and the README also contradict the protocol.
- **Problem:** The claim is false. The phone layout uses 760px:
  `narrow_layout.ts` reports a window at most 760px wide, and
  `css_chrome_flow.ts`, `css_previews.ts`, and `css_views_responsive.ts` use
  `@media (max-width: 760px)`. Since PR #249,
  `packages/ui/src/screen-header/screen-header.css:120` uses it too.
  The compact search uses the 560px container query of
  `packages/viewer/src/viewer/styles.ts`.
- **Impact if no action:** A maintainer who trusts the comment can change
  `NARROW_SHELL` and expect every layout to follow, and miss the two other
  widths.
- **Root question:** How should the shell docs describe the widths that
  switch its layouts?
- **Options:**
  - **A.** Narrow the claim in the header and the README: name each width,
    900px, 760px, and 560px, and what it switches. Effort: Small
    (estimate).
  - **B.** Apply A, and give each width a named constant in one breakpoint
    module that every rule reads. Effort: Medium (estimate).
- **Left out:** Making every rule read `NARROW_SHELL` moves the phone frame
  and the compact search to 900px, which changes the product's layouts.
- **Wider fix:** None. The `documentation` skill already requires docs that
  match the code.
- **Previous examples:** None found.
- **Recommendation:** A. (estimate) It corrects the docs without a code
  change.
- **Action:** fix after merge, apply A (estimate), because a comment and a
  README that contradict the code are docs drift.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4839).
